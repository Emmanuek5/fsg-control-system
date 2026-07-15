import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { ApprovalDecisionDto, CreateFinancialRequestDto, CreateRequestCommentDto, UpdateFinancialRequestDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MonnifyPaymentsService } from '../monnify/monnify-payments.service';
import { MonnifyService } from '../monnify/monnify.service';
import type { RequestUser } from '../common/current-user.decorator';

const include = {
  subsidiary: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  executedBy: { select: { id: true, name: true, email: true } },
  expense: { select: { id: true, paymentStatus: true } },
};

const providerTypes = new Set(['BANK_TRANSFER', 'AIRTIME', 'DATA_BUNDLE', 'ELECTRICITY_BILL']);
const billTypes = new Set(['AIRTIME', 'DATA_BUNDLE', 'ELECTRICITY_BILL']);

@Injectable()
export class FinancialRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationsService,
    private readonly monnifyPayments: MonnifyPaymentsService,
    private readonly monnify: MonnifyService,
  ) {}

  private assertTypeAvailable(type: string) {
    if (billTypes.has(type) && !this.monnify.billsEnabled()) {
      throw new BadRequestException(
        'Airtime, data and electricity requests are currently unavailable. Request a bank transfer to your account and purchase it yourself, or record a cash expense.',
      );
    }
  }

  private async canApprove(user: RequestUser) {
    const keys = user.roleId ? await this.permissions.getRolePermissions(user.roleId) : [];
    return keys.includes('financial_requests:approve');
  }

  private merchantRef() {
    return `FSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  }

  async list(user: RequestUser, status?: string, type?: string) {
    const approver = await this.canApprove(user);
    return this.prisma.financialRequest.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(type ? { type: type as any } : {}),
        ...(approver ? {} : { requestedById: user.id }),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include,
    });
  }

  async get(id: string, user: RequestUser) {
    const request = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id }, include });
    if (!(await this.canApprove(user)) && request.requestedById !== user.id) {
      throw new ForbiddenException('You can only view your own financial requests');
    }
    const comments = await this.prisma.requestComment.findMany({
      where: { entityType: 'FINANCIAL_REQUEST', entityId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { ...request, comments };
  }

  async create(dto: CreateFinancialRequestDto, user: RequestUser) {
    this.assertTypeAvailable(dto.type);
    const usesProvider = providerTypes.has(dto.type);
    const request = await this.prisma.financialRequest.create({
      data: {
        type: dto.type,
        subsidiaryId: dto.subsidiaryId ?? null,
        department: dto.department ?? null,
        amount: dto.amount,
        category: dto.category,
        description: dto.description ?? null,
        vendor: dto.vendor ?? null,
        payeeName: dto.payeeName ?? null,
        bankName: dto.bankName ?? null,
        bankCode: dto.bankCode ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? null,
        requestedFor: dto.requestedFor ?? null,
        attachmentUrl: dto.attachmentUrl ?? null,
        phoneNumber: dto.phoneNumber ?? null,
        network: dto.network?.toUpperCase() ?? null,
        dataPlan: dto.dataPlan ?? null,
        disco: dto.disco ?? null,
        customerId: dto.customerId ?? null,
        meterType: dto.meterType?.toUpperCase() ?? null,
        payerName: dto.payerName ?? null,
        merchantTxRef: usesProvider ? this.merchantRef() : null,
        provider: usesProvider ? 'MONNIFY' : 'NONE',
        requestedById: user.id,
      },
      include,
    });
    await this.notifications.notifyUsersWithPermission('financial_requests:approve', {
      type: 'REQUEST_SUBMITTED',
      title: 'Financial request submitted',
      message: `${request.requestedBy?.name ?? user.email} requested ${request.category} (${request.type})`,
      entityType: 'FINANCIAL_REQUEST',
      entityId: request.id,
      href: `/financial-requests/${request.id}`,
    }, user.id);
    return request;
  }

  async update(id: string, dto: UpdateFinancialRequestDto, user: RequestUser) {
    const existing = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id } });
    if (existing.requestedById !== user.id && !(await this.canApprove(user))) {
      throw new ForbiddenException('You can only update your own financial requests');
    }
    if (!['PENDING', 'NEEDS_INFO'].includes(existing.status)) {
      throw new BadRequestException('Only pending or needs-info requests can be updated');
    }
    const nextType = dto.type ?? existing.type;
    if (dto.type && dto.type !== existing.type) this.assertTypeAvailable(dto.type);
    const usesProvider = providerTypes.has(nextType);
    const request = await this.prisma.financialRequest.update({
      where: { id },
      data: {
        type: dto.type,
        subsidiaryId: dto.subsidiaryId,
        department: dto.department,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        vendor: dto.vendor,
        payeeName: dto.payeeName,
        bankName: dto.bankName,
        bankCode: dto.bankCode,
        bankAccountNumber: dto.bankAccountNumber,
        requestedFor: dto.requestedFor,
        attachmentUrl: dto.attachmentUrl,
        phoneNumber: dto.phoneNumber,
        network: dto.network?.toUpperCase(),
        dataPlan: dto.dataPlan,
        disco: dto.disco,
        customerId: dto.customerId,
        meterType: dto.meterType?.toUpperCase(),
        payerName: dto.payerName,
        merchantTxRef: usesProvider ? existing.merchantTxRef ?? this.merchantRef() : null,
        provider: usesProvider ? 'MONNIFY' : 'NONE',
        status: 'PENDING',
        decisionNote: null,
      },
      include,
    });
    await this.notifications.notifyUsersWithPermission('financial_requests:approve', {
      type: 'REQUEST_UPDATED',
      title: 'Financial request updated',
      message: `${request.requestedBy?.name ?? 'A user'} updated a financial request`,
      entityType: 'FINANCIAL_REQUEST',
      entityId: request.id,
      href: `/financial-requests/${request.id}`,
    }, user.id);
    return request;
  }

  async approve(id: string, dto: ApprovalDecisionDto, user: RequestUser) {
    const existing = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id } });
    if (existing.status !== 'PENDING') throw new BadRequestException('Only pending requests can be approved');
    if (existing.expenseId) throw new BadRequestException('This request has already posted an expense');

    const request = await this.prisma.$transaction(async (tx) => {
      let expenseId: string | null = null;
      if (existing.type === 'CASH_EXPENSE' || existing.type === 'BANK_TRANSFER') {
        const expense = await tx.expense.create({
          data: {
            subsidiaryId: existing.subsidiaryId,
            category: existing.category,
            description: existing.description,
            vendor: existing.vendor ?? existing.payeeName,
            amount: existing.amount,
            incurredAt: existing.requestedFor ?? new Date(),
            receiptUrl: existing.attachmentUrl,
            paymentStatus: 'APPROVED_NOT_PAID',
            createdById: existing.requestedById,
          },
        });
        expenseId = expense.id;
      }
      return tx.financialRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          decisionNote: dto.note ?? null,
          approvedById: user.id,
          decidedAt: new Date(),
          expenseId,
        },
        include,
      });
    });

    await this.notifications.notifyUser(request.requestedById, {
      type: 'REQUEST_APPROVED',
      title: 'Financial request approved',
      message: dto.note ?? `Your ${request.category} request was approved.`,
      entityType: 'FINANCIAL_REQUEST',
      entityId: request.id,
      href: `/financial-requests/${request.id}`,
    });
    return request;
  }

  async deny(id: string, dto: ApprovalDecisionDto, user: RequestUser) {
    return this.decideWithoutPosting(id, 'DENIED', dto, user, 'REQUEST_DENIED', 'Financial request denied');
  }

  async requestInfo(id: string, dto: ApprovalDecisionDto, user: RequestUser) {
    const request = await this.decideWithoutPosting(id, 'NEEDS_INFO', dto, user, 'NEEDS_INFO', 'More info needed for financial request');
    if (dto.note) {
      await this.prisma.requestComment.create({
        data: { entityType: 'FINANCIAL_REQUEST', entityId: id, authorId: user.id, message: dto.note, isInstruction: true },
      });
    }
    return request;
  }

  private async decideWithoutPosting(id: string, status: 'DENIED' | 'NEEDS_INFO', dto: ApprovalDecisionDto, user: RequestUser, type: any, title: string) {
    const existing = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id } });
    if (existing.status !== 'PENDING') throw new BadRequestException('Only pending requests can be changed');
    const request = await this.prisma.financialRequest.update({
      where: { id },
      data: { status, decisionNote: dto.note ?? null, approvedById: user.id, decidedAt: new Date() },
      include,
    });
    await this.notifications.notifyUser(request.requestedById, {
      type,
      title,
      message: dto.note ?? null,
      entityType: 'FINANCIAL_REQUEST',
      entityId: request.id,
      href: `/financial-requests/${request.id}`,
    });
    return request;
  }

  async addComment(id: string, dto: Omit<CreateRequestCommentDto, 'entityType' | 'entityId'>, user: RequestUser) {
    const request = await this.prisma.financialRequest.findUniqueOrThrow({ where: { id } });
    const approver = await this.canApprove(user);
    if (!approver && request.requestedById !== user.id) throw new ForbiddenException('You cannot comment on this request');
    const comment = await this.prisma.requestComment.create({
      data: { entityType: 'FINANCIAL_REQUEST', entityId: id, authorId: user.id, message: dto.message, isInstruction: approver && !!dto.isInstruction },
      include: { author: { select: { id: true, name: true } } },
    });
    if (approver) {
      await this.notifications.notifyUser(request.requestedById, {
        type: dto.isInstruction ? 'NEEDS_INFO' : 'GENERAL',
        title: dto.isInstruction ? 'Instruction added to financial request' : 'Comment added to financial request',
        message: dto.message,
        entityType: 'FINANCIAL_REQUEST',
        entityId: id,
        href: `/financial-requests/${id}`,
      });
    } else {
      await this.notifications.notifyUsersWithPermission('financial_requests:approve', {
        type: 'REQUEST_UPDATED',
        title: 'Financial request comment added',
        message: dto.message,
        entityType: 'FINANCIAL_REQUEST',
        entityId: id,
        href: `/financial-requests/${id}`,
      }, user.id);
    }
    return comment;
  }

  pay(id: string, user: RequestUser) {
    return this.monnifyPayments.payFinancialRequest(id, user);
  }

  payValidateOtp(id: string, user: RequestUser, dto: { authorizationCode: string }) {
    return this.monnifyPayments.validateOtp(id, user, dto.authorizationCode);
  }

  payRefresh(id: string, user: RequestUser) {
    return this.monnifyPayments.refresh(id, user);
  }
  async remove(id: string) {
    await this.prisma.financialRequest.delete({ where: { id } });
    return { ok: true };
  }
}

