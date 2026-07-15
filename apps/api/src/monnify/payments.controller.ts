import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { MonnifyService, MonnifyBiller, MonnifyBillerCategory, MonnifyBillerProduct } from './monnify.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly monnify: MonnifyService) {}

  @Get('status')
  status() {
    return { configured: this.monnify.isConfigured(), billsEnabled: this.monnify.billsEnabled() };
  }

  @Get('banks')
  banks() {
    return this.monnify.listBanks();
  }

  @Get('bank/validate')
  bankValidate(@Query('accountNumber') accountNumber?: string, @Query('bankCode') bankCode?: string) {
    if (!accountNumber || !bankCode) throw new BadRequestException('accountNumber and bankCode are required');
    return this.monnify.validateAccount(accountNumber, bankCode);
  }

  @Get('data-products')
  async dataProducts(@Query('network') network?: string) {
    if (!network) throw new BadRequestException('network is required');
    const biller = await this.findBiller(['data', 'airtime'], network);
    if (!biller) return [];
    const products = await this.monnify.listBillerProducts(this.billerCode(biller));
    return products.map((product) => ({ productCode: this.productCode(product), plan: this.productName(product), amount: Number(product.amount ?? 0) }));
  }

  @Get('electricity/discos')
  async discos() {
    const category = await this.findCategory(['electric']);
    if (!category) return [];
    const billers = await this.monnify.listBillers(this.categoryCode(category));
    return billers.map((biller) => ({ code: this.billerCode(biller), name: this.billerName(biller) }));
  }

  @Get('electricity/validate')
  async electricityValidate(@Query('disco') disco?: string, @Query('customerId') customerId?: string, @Query('meterType') meterType?: string) {
    if (!disco || !customerId) throw new BadRequestException('disco and customerId are required');
    const products = await this.monnify.listBillerProducts(disco);
    const product = this.matchProduct(products, meterType) ?? products[0];
    if (!product) throw new BadRequestException('No electricity product found');
    const result = await this.monnify.validateBillCustomer(this.productCode(product), customerId);
    return { customerName: result.customerName ?? '', productCode: this.productCode(product), validationReference: result.validationReference };
  }

  @Get('wallet-balance')
  @RequirePermissions('payments:read')
  walletBalance() {
    return this.monnify.getWalletBalance();
  }

  private async findBiller(categoryTerms: string[], billerTerm: string) {
    const category = await this.findCategory(categoryTerms);
    if (!category) return null;
    const billers = await this.monnify.listBillers(this.categoryCode(category));
    const needle = billerTerm.toLowerCase();
    return billers.find((biller) => this.billerName(biller).toLowerCase().includes(needle)) ?? null;
  }

  private async findCategory(terms: string[]) {
    const categories = await this.monnify.listBillerCategories();
    return categories.find((category) => terms.some((term) => `${this.categoryCode(category)} ${this.categoryName(category)}`.toLowerCase().includes(term))) ?? null;
  }

  private matchProduct(products: MonnifyBillerProduct[], meterType?: string) {
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
