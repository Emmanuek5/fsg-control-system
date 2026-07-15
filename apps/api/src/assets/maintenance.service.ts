import { Injectable } from '@nestjs/common';
import type { CreateMaintenanceDto, UpdateMaintenanceDto } from '@fsg/shared';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: RequestUser, assetId?: string) {
    const now = new Date();
    const logs = await this.prisma.maintenanceLog.findMany({
      where: assetId ? { assetId } : undefined,
      orderBy: { scheduledDate: 'desc' },
      include: { asset: { select: { id: true, name: true } } },
    });
    const seesFinance = await this.permissions.roleHas(user.roleId, 'finance:read');
    return logs.map((l) => ({
      ...l,
      cost: seesFinance ? l.cost : null,
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
