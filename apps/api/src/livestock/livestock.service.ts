import { Injectable } from '@nestjs/common';
import type { CreateLivestockDto, UpdateLivestockDto } from '@fsg/shared';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LivestockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: RequestUser) {
    const [animals, seesFinance] = await Promise.all([
      this.prisma.livestock.findMany({
        orderBy: { createdAt: 'desc' },
        include: { subsidiary: { select: { id: true, name: true } } },
      }),
      this.permissions.roleHas(user.roleId, 'finance:read'),
    ]);
    return animals.map((animal) => ({
      ...animal,
      acquisitionCost: seesFinance ? animal.acquisitionCost : null,
    }));
  }

  create(dto: CreateLivestockDto) {
    return this.prisma.livestock.create({
      data: { ...dto, subsidiaryId: dto.subsidiaryId ?? null },
    });
  }

  update(id: string, dto: UpdateLivestockDto) {
    return this.prisma.livestock.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.livestock.delete({ where: { id } });
    return { ok: true };
  }
}
