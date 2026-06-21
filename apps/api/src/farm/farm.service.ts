import { Injectable } from '@nestjs/common';
import type {
  BatchType,
  CreateEggProductionDto,
  CreateFarmBatchDto,
  CreateFeedDto,
  CreateMortalityDto,
  UpdateFarmBatchDto,
} from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FarmService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getBatch(id: string) {
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
    return {
      ...batch,
      mortalityTotal,
      totalEggs,
      totalFeedKg,
      currentAlive: Math.max(0, batch.initialCount - mortalityTotal),
    };
  }

  createBatch(dto: CreateFarmBatchDto) {
    return this.prisma.farmBatch.create({ data: { ...dto, subsidiaryId: dto.subsidiaryId ?? null } });
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

  listFeed(batchId: string) {
    return this.prisma.feedRecord.findMany({ where: { batchId }, orderBy: { date: 'desc' } });
  }
  createFeed(dto: CreateFeedDto) {
    return this.prisma.feedRecord.create({ data: dto });
  }
}
