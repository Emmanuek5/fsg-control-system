import { Injectable } from '@nestjs/common';
import { MovementType, type CreateMovementDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(productId?: string) {
    return this.prisma.inventoryMovement.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { occurredAt: 'desc' },
      take: 200,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  /** Records a movement and adjusts the product's stock on hand atomically. */
  async create(dto: CreateMovementDto, userId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: dto.productId } });

      let newQty = product.quantityOnHand;
      if (dto.type === MovementType.IN) newQty += dto.quantity;
      else if (dto.type === MovementType.OUT) newQty = Math.max(0, newQty - dto.quantity);
      else newQty = dto.quantity; // ADJUSTMENT sets the absolute count

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          type: dto.type,
          quantity: dto.quantity,
          unitCost: dto.unitCost ?? null,
          reference: dto.reference ?? null,
          note: dto.note ?? null,
          receiptUrl: dto.receiptUrl ?? null,
          occurredAt: dto.occurredAt ?? new Date(),
          createdById: userId,
        },
        include: { product: { select: { id: true, name: true, sku: true } } },
      });

      await tx.product.update({ where: { id: dto.productId }, data: { quantityOnHand: newQty } });
      return movement;
    });
  }
}
