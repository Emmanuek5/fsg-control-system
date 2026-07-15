import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { MovementType, type ApprovalDecisionDto, type CreateRequestCommentDto, type CreateStockRequestDto, type UpdateStockRequestDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestUser } from '../common/current-user.decorator';

const include = {
  product: { select: { id: true, name: true, sku: true, unit: true, quantityOnHand: true } },
  subsidiary: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  inventoryMovement: { select: { id: true, occurredAt: true } },
};

@Injectable()
export class StockRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async canApprove(user: RequestUser) {
    const keys = user.roleId ? await this.permissions.getRolePermissions(user.roleId) : [];
    return keys.includes('stock_requests:approve');
  }

  async list(user: RequestUser, status?: string) {
    const approver = await this.canApprove(user);
    return this.prisma.stockRequest.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(approver ? {} : { requestedById: user.id }),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include,
    });
  }

  async get(id: string, user: RequestUser) {
    const request = await this.prisma.stockRequest.findUniqueOrThrow({ where: { id }, include });
    if (!(await this.canApprove(user)) && request.requestedById !== user.id) {
      throw new ForbiddenException('You can only view your own stock requests');
    }
    const comments = await this.prisma.requestComment.findMany({
      where: { entityType: 'STOCK_REQUEST', entityId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { ...request, comments };
  }

  async create(dto: CreateStockRequestDto, user: RequestUser) {
    const request = await this.prisma.stockRequest.create({
      data: {
        productId: dto.productId,
        subsidiaryId: dto.subsidiaryId ?? null,
        type: dto.type,
        quantity: dto.quantity,
        unitCost: dto.unitCost ?? null,
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        receiptUrl: dto.receiptUrl ?? null,
        requestedById: user.id,
      },
      include,
    });
    await this.notifications.notifyUsersWithPermission(
      'stock_requests:approve',
      {
        type: 'REQUEST_SUBMITTED',
        title: 'Stock request submitted',
        message: `${request.requestedBy?.name ?? user.email} requested ${request.type} ${request.quantity} for ${request.product.name}`,
        entityType: 'STOCK_REQUEST',
        entityId: request.id,
        href: `/stock-requests/${request.id}`,
      },
      user.id,
    );
    return request;
  }

  async update(id: string, dto: UpdateStockRequestDto, user: RequestUser) {
    const existing = await this.prisma.stockRequest.findUniqueOrThrow({ where: { id } });
    if (existing.requestedById !== user.id && !(await this.canApprove(user))) {
      throw new ForbiddenException('You can only update your own stock requests');
    }
    if (!['PENDING', 'NEEDS_INFO'].includes(existing.status)) {
      throw new BadRequestException('Only pending or needs-info requests can be updated');
    }
    const request = await this.prisma.stockRequest.update({
      where: { id },
      data: {
        productId: dto.productId,
        subsidiaryId: dto.subsidiaryId,
        type: dto.type,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        reference: dto.reference,
        note: dto.note,
        receiptUrl: dto.receiptUrl,
        status: 'PENDING',
        decisionNote: null,
      },
      include,
    });
    await this.notifications.notifyUsersWithPermission('stock_requests:approve', {
      type: 'REQUEST_UPDATED',
      title: 'Stock request updated',
      message: `${request.requestedBy?.name ?? 'A user'} updated a stock request`,
      entityType: 'STOCK_REQUEST',
      entityId: request.id,
      href: `/stock-requests/${request.id}`,
    }, user.id);
    return request;
  }

  async approve(id: string, dto: ApprovalDecisionDto, user: RequestUser) {
    const existing = await this.prisma.stockRequest.findUniqueOrThrow({ where: { id }, include: { product: true } });
    if (existing.status !== 'PENDING') throw new BadRequestException('Only pending requests can be approved');
    if (existing.inventoryMovementId) throw new BadRequestException('This request has already posted stock');

    const request = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: existing.productId } });
      let newQty = product.quantityOnHand;
      if (existing.type === MovementType.IN) newQty += existing.quantity;
      else if (existing.type === MovementType.OUT) newQty = Math.max(0, newQty - existing.quantity);
      else newQty = existing.quantity;

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: existing.productId,
          type: existing.type,
          quantity: existing.quantity,
          unitCost: existing.unitCost,
          reference: existing.reference,
          note: existing.note,
          receiptUrl: existing.receiptUrl,
          createdById: existing.requestedById,
        },
      });
      await tx.product.update({ where: { id: product.id }, data: { quantityOnHand: newQty } });
      return tx.stockRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          decisionNote: dto.note ?? null,
          approvedById: user.id,
          decidedAt: new Date(),
          inventoryMovementId: movement.id,
        },
        include,
      });
    });

    await this.notifications.notifyUser(request.requestedById, {
      type: 'REQUEST_APPROVED',
      title: 'Stock request approved',
      message: dto.note ?? `Your stock request for ${request.product.name} was approved.`,
      entityType: 'STOCK_REQUEST',
      entityId: request.id,
      href: `/stock-requests/${request.id}`,
    });
    return request;
  }

  async deny(id: string, dto: ApprovalDecisionDto, user: RequestUser) {
    return this.decideWithoutPosting(id, 'DENIED', dto, user, 'REQUEST_DENIED', 'Stock request denied');
  }

  async requestInfo(id: string, dto: ApprovalDecisionDto, user: RequestUser) {
    const request = await this.decideWithoutPosting(id, 'NEEDS_INFO', dto, user, 'NEEDS_INFO', 'More info needed for stock request');
    if (dto.note) {
      await this.prisma.requestComment.create({
        data: { entityType: 'STOCK_REQUEST', entityId: id, authorId: user.id, message: dto.note, isInstruction: true },
      });
    }
    return request;
  }

  private async decideWithoutPosting(id: string, status: 'DENIED' | 'NEEDS_INFO', dto: ApprovalDecisionDto, user: RequestUser, type: any, title: string) {
    const existing = await this.prisma.stockRequest.findUniqueOrThrow({ where: { id } });
    if (existing.status !== 'PENDING') throw new BadRequestException('Only pending requests can be changed');
    const request = await this.prisma.stockRequest.update({
      where: { id },
      data: { status, decisionNote: dto.note ?? null, approvedById: user.id, decidedAt: new Date() },
      include,
    });
    await this.notifications.notifyUser(request.requestedById, {
      type,
      title,
      message: dto.note ?? null,
      entityType: 'STOCK_REQUEST',
      entityId: request.id,
      href: `/stock-requests/${request.id}`,
    });
    return request;
  }

  async addComment(id: string, dto: Omit<CreateRequestCommentDto, 'entityType' | 'entityId'>, user: RequestUser) {
    const request = await this.prisma.stockRequest.findUniqueOrThrow({ where: { id } });
    const approver = await this.canApprove(user);
    if (!approver && request.requestedById !== user.id) throw new ForbiddenException('You cannot comment on this request');
    const comment = await this.prisma.requestComment.create({
      data: { entityType: 'STOCK_REQUEST', entityId: id, authorId: user.id, message: dto.message, isInstruction: approver && !!dto.isInstruction },
      include: { author: { select: { id: true, name: true } } },
    });
    if (approver) {
      await this.notifications.notifyUser(request.requestedById, {
        type: dto.isInstruction ? 'NEEDS_INFO' : 'GENERAL',
        title: dto.isInstruction ? 'Instruction added to stock request' : 'Comment added to stock request',
        message: dto.message,
        entityType: 'STOCK_REQUEST',
        entityId: id,
        href: `/stock-requests/${id}`,
      });
    } else {
      await this.notifications.notifyUsersWithPermission('stock_requests:approve', {
        type: 'REQUEST_UPDATED',
        title: 'Stock request comment added',
        message: dto.message,
        entityType: 'STOCK_REQUEST',
        entityId: id,
        href: `/stock-requests/${id}`,
      }, user.id);
    }
    return comment;
  }

  async remove(id: string) {
    await this.prisma.stockRequest.delete({ where: { id } });
    return { ok: true };
  }
}
