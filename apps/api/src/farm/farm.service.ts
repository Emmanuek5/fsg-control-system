import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MovementType,
  type BatchType,
  type CreateEggProductionDto,
  type CreateFarmBatchDto,
  type CreateFarmDispatchDto,
  type CreateFeedDto,
  type CreateMortalityDto,
  type UpdateFarmBatchDto,
} from '@fsg/shared';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { applyMovement, resolveStock } from '../inventory/stock';

const dispatchInclude = {
  product: { select: { id: true, name: true, unit: true } },
  variant: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
};

@Injectable()
export class FarmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async listBatches(type?: BatchType) {
    const batches = await this.prisma.farmBatch.findMany({
      where: type ? { type } : undefined,
      orderBy: { startDate: 'desc' },
      include: {
        subsidiary: { select: { id: true, name: true } },
        mortalityRecords: { select: { count: true } },
        dispatches: { select: { type: true, quantity: true } },
        _count: { select: { eggProduction: true, feedRecords: true } },
      },
    });
    return batches.map(({ mortalityRecords, dispatches, ...b }) => {
      const mortalityTotal = mortalityRecords.reduce((s, r) => s + r.count, 0);
      const birdsProcessed = dispatches
        .filter((d) => d.type === 'BIRDS')
        .reduce((s, d) => s + d.quantity, 0);
      return {
        ...b,
        mortalityTotal,
        birdsProcessed,
        currentAlive: Math.max(0, b.initialCount - mortalityTotal - birdsProcessed),
      };
    });
  }

  /**
   * Whole-batch totals from aggregates, not the last-90 slices the detail
   * lists show — dispatch validation depends on these being exact.
   */
  private async batchTotals(batchId: string) {
    const [eggs, mortality, feed, dispatches] = await Promise.all([
      this.prisma.eggProduction.aggregate({
        where: { batchId },
        _sum: { eggsCollected: true, damaged: true },
      }),
      this.prisma.mortalityRecord.aggregate({ where: { batchId }, _sum: { count: true } }),
      this.prisma.feedRecord.aggregate({
        where: { batchId },
        _sum: { quantityKg: true, quantityBags: true, cost: true },
      }),
      this.prisma.farmDispatch.groupBy({
        by: ['type'],
        where: { batchId },
        _sum: { quantity: true },
      }),
    ]);
    const dispatched = (type: 'EGGS' | 'BIRDS') =>
      dispatches.find((d) => d.type === type)?._sum.quantity ?? 0;
    return {
      totalEggs: eggs._sum.eggsCollected ?? 0,
      totalDamaged: eggs._sum.damaged ?? 0,
      mortalityTotal: mortality._sum.count ?? 0,
      totalFeedKg: feed._sum.quantityKg ?? 0,
      totalFeedBags: feed._sum.quantityBags ?? 0,
      totalFeedCost: feed._sum.cost ?? 0,
      eggsSent: dispatched('EGGS'),
      birdsProcessed: dispatched('BIRDS'),
    };
  }

  async getBatch(user: RequestUser, id: string) {
    const [batch, totals, seesFinance] = await Promise.all([
      this.prisma.farmBatch.findUniqueOrThrow({
        where: { id },
        include: {
          subsidiary: { select: { id: true, name: true } },
          eggProduction: { orderBy: { date: 'desc' }, take: 90 },
          mortalityRecords: { orderBy: { date: 'desc' }, take: 90 },
          feedRecords: { orderBy: { date: 'desc' }, take: 90 },
          dispatches: { orderBy: { date: 'desc' }, take: 90, include: dispatchInclude },
        },
      }),
      this.batchTotals(id),
      this.permissions.roleHas(user.roleId, 'finance:read'),
    ]);
    return {
      ...batch,
      feedRecords: batch.feedRecords.map((record) => ({
        ...record,
        cost: seesFinance ? record.cost : null,
        costPerBag: seesFinance ? record.costPerBag : null,
      })),
      ...totals,
      totalFeedCost: seesFinance ? totals.totalFeedCost : null,
      eggsOnHand: Math.max(0, totals.totalEggs - totals.totalDamaged - totals.eggsSent),
      currentAlive: Math.max(
        0,
        batch.initialCount - totals.mortalityTotal - totals.birdsProcessed,
      ),
    };
  }

  createBatch(dto: CreateFarmBatchDto) {
    return this.prisma.farmBatch.create({
      data: { ...dto, subsidiaryId: dto.subsidiaryId ?? null },
    });
  }

  updateBatch(id: string, dto: UpdateFarmBatchDto) {
    return this.prisma.farmBatch.update({ where: { id }, data: dto });
  }

  async removeBatch(id: string) {
    await this.prisma.farmBatch.delete({ where: { id } });
    return { ok: true };
  }

  listEggs(batchId: string) {
    return this.prisma.eggProduction.findMany({ where: { batchId }, orderBy: { date: 'desc' } });
  }
  createEgg(dto: CreateEggProductionDto) {
    return this.prisma.eggProduction.create({ data: dto });
  }

  listMortality(batchId: string) {
    return this.prisma.mortalityRecord.findMany({ where: { batchId }, orderBy: { date: 'desc' } });
  }
  createMortality(dto: CreateMortalityDto) {
    return this.prisma.mortalityRecord.create({ data: dto });
  }

  async listFeed(user: RequestUser, batchId: string) {
    const [records, seesFinance] = await Promise.all([
      this.prisma.feedRecord.findMany({ where: { batchId }, orderBy: { date: 'desc' } }),
      this.permissions.roleHas(user.roleId, 'finance:read'),
    ]);
    return records.map((record) => ({
      ...record,
      cost: seesFinance ? record.cost : null,
      costPerBag: seesFinance ? record.costPerBag : null,
    }));
  }
  createFeed(dto: CreateFeedDto) {
    return this.prisma.feedRecord.create({
      data: {
        batchId: dto.batchId,
        date: dto.date,
        feedType: dto.feedType ?? null,
        quantityBags: dto.quantityBags,
        costPerBag: dto.costPerBag ?? null,
        cost: dto.quantityBags * (dto.costPerBag ?? 0),
      },
    });
  }

  listDispatches(batchId: string) {
    return this.prisma.farmDispatch.findMany({
      where: { batchId },
      orderBy: { date: 'desc' },
      include: dispatchInclude,
    });
  }

  /**
   * Record eggs sent out (layers) or birds processed (broilers). The dispatch
   * kind comes from the batch, not the client. When a shop product is chosen
   * the goods post as stock IN in the same transaction, so the farm log and
   * shop inventory cannot drift apart.
   */
  async createDispatch(dto: CreateFarmDispatchDto, user: RequestUser) {
    const batch = await this.prisma.farmBatch.findUniqueOrThrow({ where: { id: dto.batchId } });
    const type = batch.type === 'LAYERS' ? 'EGGS' : 'BIRDS';
    const totals = await this.batchTotals(dto.batchId);

    if (type === 'BIRDS') {
      const alive = batch.initialCount - totals.mortalityTotal - totals.birdsProcessed;
      if (dto.quantity > alive) {
        throw new BadRequestException(
          `Only ${alive} birds are alive in this batch — cannot process ${dto.quantity}`,
        );
      }
    } else {
      const onHand = totals.totalEggs - totals.totalDamaged - totals.eggsSent;
      if (dto.quantity > onHand) {
        throw new BadRequestException(
          `Only ${onHand} eggs are on hand (collected minus damaged and already sent) — cannot send ${dto.quantity}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let inventoryMovementId: string | null = null;
      let productId: string | null = null;
      let variantId: string | null = null;
      let unitsAdded: number | null = null;

      if (dto.productId) {
        const resolved = await resolveStock(tx, dto.productId, dto.variantId);
        unitsAdded = dto.unitsAdded ?? dto.quantity;
        const movement = await tx.inventoryMovement.create({
          data: {
            productId: resolved.product.id,
            variantId: resolved.variant.id,
            type: MovementType.IN,
            quantity: unitsAdded,
            reference: 'FARM_DISPATCH',
            note: `${type === 'EGGS' ? 'Eggs' : 'Processed birds'} from batch ${batch.name}`,
            occurredAt: dto.date,
            createdById: user.id,
          },
        });
        await applyMovement(tx, resolved, MovementType.IN, unitsAdded);
        inventoryMovementId = movement.id;
        productId = resolved.product.id;
        variantId = resolved.variant.id;
      }

      return tx.farmDispatch.create({
        data: {
          batchId: dto.batchId,
          type,
          date: dto.date,
          quantity: dto.quantity,
          productId,
          variantId,
          unitsAdded,
          inventoryMovementId,
          destination: dto.destination ?? null,
          note: dto.note ?? null,
          createdById: user.id,
        },
        include: dispatchInclude,
      });
    });
  }
}
