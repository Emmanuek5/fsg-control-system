import { Injectable } from '@nestjs/common';
import type { CreateAssetDto, UpdateAssetDto } from '@fsg/shared';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: RequestUser) {
    const now = new Date();
    const assets = await this.prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subsidiary: { select: { id: true, name: true } },
        maintenanceLogs: { where: { status: 'SCHEDULED' }, select: { scheduledDate: true } },
      },
    });
    const seesFinance = await this.permissions.roleHas(user.roleId, 'finance:read');
    return assets.map(({ maintenanceLogs, ...a }) => ({
      ...a,
      purchaseCost: seesFinance ? a.purchaseCost : null,
      currentValue: seesFinance ? a.currentValue : null,
      overdueCount: maintenanceLogs.filter((m) => m.scheduledDate < now).length,
    }));
  }

  async getAsset(user: RequestUser, id: string) {
    const [asset, seesFinance] = await Promise.all([
      this.prisma.asset.findUniqueOrThrow({
        where: { id },
        include: {
          subsidiary: { select: { id: true, name: true } },
          maintenanceLogs: { orderBy: { scheduledDate: 'desc' } },
        },
      }),
      this.permissions.roleHas(user.roleId, 'finance:read'),
    ]);
    return {
      ...asset,
      purchaseCost: seesFinance ? asset.purchaseCost : null,
      currentValue: seesFinance ? asset.currentValue : null,
      maintenanceLogs: asset.maintenanceLogs.map((log) => ({
        ...log,
        cost: seesFinance ? log.cost : null,
      })),
    };
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
