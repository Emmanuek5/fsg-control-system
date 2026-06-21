import { Injectable } from '@nestjs/common';
import type { CreateMaintenanceDto, UpdateMaintenanceDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(assetId?: string) {
    const now = new Date();
    const logs = await this.prisma.maintenanceLog.findMany({
      where: assetId ? { assetId } : undefined,
      orderBy: { scheduledDate: 'desc' },
      include: { asset: { select: { id: true, name: true } } },
    });
    return logs.map((l) => ({
      ...l,
      isOverdue: l.status === 'SCHEDULED' && l.scheduledDate < now,
    }));
  }

  create(dto: CreateMaintenanceDto) {
    return this.prisma.maintenanceLog.create({ data: dto });
  }

  update(id: string, dto: UpdateMaintenanceDto) {
    return this.prisma.maintenanceLog.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.maintenanceLog.delete({ where: { id } });
    return { ok: true };
  }
}
