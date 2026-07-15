import { Injectable } from '@nestjs/common';
import type {
  BatchType,
  CreateEggProductionDto,
  CreateFarmBatchDto,
  CreateFeedDto,
  CreateMortalityDto,
  UpdateFarmBatchDto,
} from '@fsg/shared';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

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
        _count: { select: { eggProduction: true, feedRecords: true } },
      },
    });
    return batches.map(({ mortalityRecords, ...b }) => {
      const mortalityTotal = mortalityRecords.reduce((s, r) => s + r.count, 0);
      return { ...b, mortalityTotal, currentAlive: Math.max(0, b.initialCount - mortalityTotal) };
    });
  }

  async getBatch(user: RequestUser, id: string) {
    const batch = await this.prisma.farmBatch.findUniqueOrThrow({
      where: { id },
      include: {
        subsidiary: { select: { id: true, name: true } },
        eggProduction: { orderBy: { date: 'desc' }, take: 90 },
        mortalityRecords: { orderBy: { date: 'desc' }, take: 90 },
        feedRecords: { orderBy: { date: 'desc' }, take: 90 },
      },
    });
    const mortalityTotal = batch.mortalityRecords.reduce((s, r) => s + r.count, 0);
    const totalEggs = batch.eggProduction.reduce((s, r) => s + r.eggsCollected, 0);
    const totalFeedKg = batch.feedRecords.reduce((s, r) => s + r.quantityKg, 0);
    const seesFinance = await this.permissions.roleHas(user.roleId, 'finance:read');
    return {
      ...batch,
      feedRecords: batch.feedRecords.map((record) => ({
        ...record,
        cost: seesFinance ? record.cost : null,
      })),
      mortalityTotal,
      totalEggs,
      totalFeedKg,
      currentAlive: Math.max(0, batch.initialCount - mortalityTotal),
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
    return records.map((record) => ({ ...record, cost: seesFinance ? record.cost : null }));
  }
  createFeed(dto: CreateFeedDto) {
    return this.prisma.feedRecord.create({ data: dto });
  }
}
