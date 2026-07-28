import { Injectable } from '@nestjs/common';
import { type CreateMovementDto } from '@fsg/shared';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { applyMovement, resolveStock } from './stock';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: RequestUser, productId?: string, variantId?: string) {
    const [movements, seesFinance] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: {
          ...(productId ? { productId } : {}),
          ...(variantId ? { variantId } : {}),
        },
        orderBy: { occurredAt: 'desc' },
        take: 200,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          variant: { select: { id: true, name: true, packSize: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.permissions.roleHas(user.roleId, 'finance:read'),
    ]);
    return movements.map((movement) => ({
      ...movement,
      unitCost: seesFinance ? movement.unitCost : null,
    }));
  }

  /**
   * Records a movement and adjusts stock atomically. The quantity is in
   * variant units; on a POOLED product the engine converts it to base units
   * before touching the pool.
   */
  async create(dto: CreateMovementDto, userId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const resolved = await resolveStock(tx, dto.productId, dto.variantId);

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: resolved.product.id,
          variantId: resolved.variant.id,
          type: dto.type,
          quantity: dto.quantity,
          unitCost: dto.unitCost ?? null,
          reference: dto.reference ?? null,
          note: dto.note ?? null,
          receiptUrl: dto.receiptUrl ?? null,
          occurredAt: dto.occurredAt ?? new Date(),
          createdById: userId,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true, packSize: true } },
        },
      });

      await applyMovement(tx, resolved, dto.type, dto.quantity);
      return movement;
    });
  }
}
