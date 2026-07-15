import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestUser } from '../common/current-user.decorator';
import { MonnifyBiller, MonnifyBillerCategory, MonnifyBillerProduct, MonnifyService } from './monnify.service';

const PAYABLE_TYPES = new Set(['BANK_TRANSFER', 'AIRTIME', 'DATA_BUNDLE', 'ELECTRICITY_BILL']);
const BILL_TYPES = new Set(['AIRTIME', 'DATA_BUNDLE', 'ELECTRICITY_BILL']);

type ProviderStatus = 'SUCCESS' | 'FAILED' | 'PROCESSING';

@Injectable()
export class MonnifyPaymentsService {
  private readonly logger = new Logger(MonnifyPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monnify: MonnifyService,
    private readonly notifications: NotificationsService,
  ) {}

  async payFinancialRequest(id: string, user: RequestUser) {
    const request = await this.loadPayable(id);
    this.monnify.assertConfigured();

    if (request.type === 'BANK_TRANSFER') {
      if (!request.bankAccountNumber || !request.bankCode) throw new BadRequestException('Bank account details are required');
      const balance = await this.monnify.getWalletBalance();
      if (Number(balance.availableBalance ?? 0) < request.amount) throw new BadRequestException('Insufficient wallet balance');
    }

    const reference = this.referenceFor(request);
    await this.prisma.$transaction(async (tx) => {
      await tx.financialRequest.update({
        where: { id },
        data: { providerStatus: 'PROCESSING', provider: 'MONNIFY', merchantTxRef: request.merchantTxRef ?? reference.replace(/-R\d+$/, ''), executedById: user.id, executedAt: new Date() },
      });
      if (request.expenseId) await tx.expense.update({ where: { id: request.expenseId }, data: { paymentStatus: 'PROCESSING' } });
    });

    let response: any;
    try {
      response = await this.callProvider(request, reference);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      await this.applyFailure(id, request.requestedById, request.category, reference, { error: message });
      throw new BadRequestException(message);
    }
    return this.applyOutcome(id, response, reference);
  }

  async validateOtp(id: string, _user: RequestUser, authorizationCode: string) {
    const request = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id }, include: { expense: true } });
    if (request.providerStatus !== 'PROCESSING' || !request.providerReference) {
      throw new BadRequestException('This request is not waiting for payment authorization');
    }
    let response: any;
    try {
      response = await this.monnify.validateTransferOtp(request.providerReference, authorizationCode);
    } catch (err) {
      // A wrong/expired OTP is retryable — don't finalize as FAILED, keep PROCESSING.
      const message = err instanceof Error ? err.message : 'OTP validation failed';
      throw new BadRequestException(message);
    }
    return this.applyOutcome(id, response, request.providerReference);
  }

  async refresh(id: string, _user: RequestUser) {
    const request = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id }, include: { expense: true } });
    if (request.providerStatus !== 'PROCESSING' || !request.providerReference) {
      throw new BadRequestException('This request has no processing payment to refresh');
    }
    const response = request.type === 'BANK_TRANSFER'
      ? await this.monnify.getTransferStatus(request.providerReference)
      : await this.monnify.getBillStatus(request.providerReference);
    return this.applyOutcome(id, response, request.providerReference);
  }

  private async loadPayable(id: string) {
    const request = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id }, include: { expense: true } });
    if (request.status !== 'APPROVED') throw new BadRequestException('Only approved requests can be paid');
    if (!['NOT_INITIATED', 'FAILED'].includes(request.providerStatus)) throw new BadRequestException('This request is not ready for payment');
    if (!PAYABLE_TYPES.has(request.type)) throw new BadRequestException('This request type cannot be paid through Monnify');
    if (BILL_TYPES.has(request.type) && !this.monnify.billsEnabled()) {
      throw new BadRequestException('Bill payments are currently unavailable. Pay this out as a bank transfer to the requester instead.');
    }
    return request;
  }

  private referenceFor(request: any) {
    const base = request.merchantTxRef ?? this.merchantRef();
    if (request.providerStatus === 'FAILED' && request.providerResponse) {
      const match = String(request.providerReference ?? '').match(/-R(\d+)$/);
      const next = match ? Number(match[1]) + 1 : 1;
      return `${base.replace(/-R\d+$/, '')}-R${next}`;
    }
    return base;
  }

  private merchantRef() {
    return `FSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  }

  private async callProvider(request: any, reference: string) {
    if (request.type === 'BANK_TRANSFER') {
      const account = await this.monnify.validateAccount(request.bankAccountNumber, request.bankCode);
      return this.monnify.initiateTransfer({
        amount: request.amount,
        reference,
        narration: request.description ?? request.category,
        destinationBankCode: request.bankCode,
        destinationAccountNumber: request.bankAccountNumber,
        destinationAccountName: account.accountName,
      });
    }

    if (request.type === 'AIRTIME' || request.type === 'DATA_BUNDLE') {
      if (!request.phoneNumber || !request.network) throw new BadRequestException('Phone number and network are required');
      const product = await this.resolveNetworkProduct(request.network, request.type === 'DATA_BUNDLE' ? request.dataPlan : null, request.amount, request.type === 'AIRTIME');
      return this.monnify.processBill({ productCode: this.productCode(product), customerId: request.phoneNumber, amount: request.amount, reference, phoneNumber: request.phoneNumber });
    }

    if (request.type === 'ELECTRICITY_BILL') {
      if (!request.disco || !request.customerId) throw new BadRequestException('Electricity customer details are required');
      const products = await this.monnify.listBillerProducts(request.disco);
      const product = this.matchProduct(products, request.meterType) ?? products[0];
      if (!product) throw new BadRequestException('No electricity product found');
      const validation = await this.monnify.validateBillCustomer(this.productCode(product), request.customerId);
      return this.monnify.processBill({
        productCode: this.productCode(product),
        customerId: request.customerId,
        amount: request.amount,
        reference,
        validationReference: validation.validationReference,
      });
    }

    throw new BadRequestException('Unsupported payment type');
  }

  private async applyOutcome(id: string, response: any, reference: string) {
    const status = this.mapOutcome(response);
    const request = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id }, select: { requestedById: true, category: true } });
    if (status === 'SUCCESS') return this.finalize(id, request.requestedById, request.category, 'SUCCESS', reference, response);
    if (status === 'FAILED') {
      await this.finalize(id, request.requestedById, request.category, 'FAILED', reference, response);
      throw new BadRequestException('Payment failed');
    }
    await this.prisma.financialRequest.update({ where: { id }, data: { providerStatus: 'PROCESSING', providerReference: reference, providerResponse: response } });
    return { requiresOtp: response?.status === 'PENDING_AUTHORIZATION', providerStatus: 'PROCESSING', providerReference: reference };
  }

  private mapOutcome(response: any): ProviderStatus {
    const value = String(response?.status ?? response?.vendStatus ?? response?.paymentStatus ?? '').toUpperCase();
    if (value === 'SUCCESS' || value === 'SUCCESSFUL') return 'SUCCESS';
    if (value === 'FAILED' || value === 'REVERSED') return 'FAILED';
    return 'PROCESSING';
  }

  private async finalize(id: string, requesterId: string | null, category: string, status: 'SUCCESS' | 'FAILED', reference: string, response: any) {
    const request = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financialRequest.update({
        where: { id },
        data: { providerStatus: status, providerReference: reference, providerResponse: response },
        include: { expense: true },
      });
      if (updated.expenseId) {
        await tx.expense.update({ where: { id: updated.expenseId }, data: { paymentStatus: status === 'SUCCESS' ? 'PAID' : 'FAILED' } });
      }
      return updated;
    });
    await this.notify(requesterId, category, id, status);
    return request;
  }

  private async applyFailure(id: string, requesterId: string | null, category: string, reference: string, response: any) {
    await this.finalize(id, requesterId, category, 'FAILED', reference, response);
  }

  private notify(userId: string | null, category: string, id: string, status: 'SUCCESS' | 'FAILED') {
    return this.notifications.notifyUser(userId, {
      type: 'PAYMENT_STATUS',
      title: status === 'SUCCESS' ? 'Payment succeeded' : 'Payment failed',
      message: `Payment for "${category}" ${status === 'SUCCESS' ? 'succeeded' : 'failed'}.`,
      entityType: 'FINANCIAL_REQUEST',
      entityId: id,
      href: `/financial-requests/${id}`,
    });
  }

  private async resolveNetworkProduct(network: string, plan: string | null, amount: number, airtime: boolean) {
    const category = await this.findCategory(airtime ? ['airtime'] : ['data', 'airtime']);
    if (!category) throw new BadRequestException('No biller category found');
    const billers = await this.monnify.listBillers(this.categoryCode(category));
    const biller = billers.find((b) => this.billerName(b).toLowerCase().includes(network.toLowerCase()));
    if (!biller) throw new BadRequestException('No network biller found');
    const products = await this.monnify.listBillerProducts(this.billerCode(biller));
    const product = products.find((p) => plan && this.productName(p).toLowerCase() === plan.toLowerCase())
      ?? products.find((p) => plan && this.productName(p).toLowerCase().includes(plan.toLowerCase()))
      ?? products.find((p) => Number(p.amount ?? 0) === Number(amount))
      ?? products[0];
    if (!product) throw new BadRequestException('No bill product found');
    return product;
  }

  private async findCategory(terms: string[]) {
    const categories = await this.monnify.listBillerCategories();
    return categories.find((category) => terms.some((term) => `${this.categoryCode(category)} ${this.categoryName(category)}`.toLowerCase().includes(term))) ?? null;
  }

  private matchProduct(products: MonnifyBillerProduct[], meterType?: string | null) {
    if (!meterType) return null;
    const needle = meterType.toLowerCase();
    return products.find((product) => this.productName(product).toLowerCase().includes(needle)) ?? null;
  }

  private categoryCode(category: MonnifyBillerCategory) { return String(category.categoryCode ?? category.code ?? ''); }
  private categoryName(category: MonnifyBillerCategory) { return String(category.categoryName ?? category.name ?? ''); }
  private billerCode(biller: MonnifyBiller) { return String(biller.billerCode ?? biller.code ?? ''); }
  private billerName(biller: MonnifyBiller) { return String(biller.billerName ?? biller.name ?? ''); }
  private productCode(product: MonnifyBillerProduct) { return String(product.productCode ?? product.code ?? ''); }
  private productName(product: MonnifyBillerProduct) { return String(product.productName ?? product.name ?? ''); }
}

