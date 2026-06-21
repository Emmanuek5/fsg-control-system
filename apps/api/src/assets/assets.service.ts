import { Injectable } from '@nestjs/common';
import type { CreateAssetDto, UpdateAssetDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const now = new Date();
    const assets = await this.prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subsidiary: { select: { id: true, name: true } },
        maintenanceLogs: { where: { status: 'SCHEDULED' }, select: { scheduledDate: true } },
      },
    });
    return assets.map(({ maintenanceLogs, ...a }) => ({
      ...a,
      overdueCount: maintenanceLogs.filter((m) => m.scheduledDate < now).length,
    }));
  }

  getAsset(id: string) {
    return this.prisma.asset.findUniqueOrThrow({
      where: { id },
      include: {
        subsidiary: { select: { id: true, name: true } },
        maintenanceLogs: { orderBy: { scheduledDate: 'desc' } },
      },
    });
  }

  create(dto: CreateAssetDto) {
    return this.prisma.asset.create({ data: { ...dto, subsidiaryId: dto.subsidiaryId ?? null } });
  }

  update(id: string, dto: UpdateAssetDto) {
    return this.prisma.asset.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.asset.delete({ where: { id } });
    return { ok: true };
  }
}
