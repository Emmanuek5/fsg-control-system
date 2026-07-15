import { Injectable } from '@nestjs/common';
import type {
  CreateCropDto,
  CreateCropInputDto,
  CreateCropRotationDto,
  UpdateCropDto,
} from '@fsg/shared';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CropsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  list() {
    return this.prisma.crop.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subsidiary: { select: { id: true, name: true } } },
    });
  }

  async get(user: RequestUser, id: string) {
    const crop = await this.prisma.crop.findUniqueOrThrow({
      where: { id },
      include: {
        subsidiary: { select: { id: true, name: true } },
        inputs: { orderBy: { date: 'desc' } },
        rotations: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    const seesFinance = await this.permissions.roleHas(user.roleId, 'finance:read');
    const totalInputCost = seesFinance ? crop.inputs.reduce((s, i) => s + i.cost, 0) : null;
    return {
      ...crop,
      inputs: crop.inputs.map((input) => ({ ...input, cost: seesFinance ? input.cost : null })),
      totalInputCost,
    };
  }

  create(dto: CreateCropDto) {
    return this.prisma.crop.create({ data: { ...dto, subsidiaryId: dto.subsidiaryId ?? null } });
  }

  update(id: string, dto: UpdateCropDto) {
    return this.prisma.crop.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.crop.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Inputs (seeds, fertilizer, herbicides, ...) ──────────────────────────

  async listInputs(user: RequestUser, cropId: string) {
    const [inputs, seesFinance] = await Promise.all([
      this.prisma.cropInput.findMany({ where: { cropId }, orderBy: { date: 'desc' } }),
      this.permissions.roleHas(user.roleId, 'finance:read'),
    ]);
    return inputs.map((input) => ({ ...input, cost: seesFinance ? input.cost : null }));
  }

  createInput(dto: CreateCropInputDto) {
    return this.prisma.cropInput.create({
      data: {
        cropId: dto.cropId,
        type: dto.type,
        name: dto.name,
        quantity: dto.quantity ?? null,
        unit: dto.unit ?? null,
        cost: dto.cost ?? 0,
        date: dto.date,
        notes: dto.notes ?? null,
      },
    });
  }

  async removeInput(id: string) {
    await this.prisma.cropInput.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Rotations ────────────────────────────────────────────────────────────

  listRotations(cropId: string) {
    return this.prisma.cropRotation.findMany({
      where: { cropId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  createRotation(dto: CreateCropRotationDto) {
    return this.prisma.cropRotation.create({
      data: {
        cropId: dto.cropId,
        season: dto.season,
        cropName: dto.cropName,
        date: dto.date ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  async removeRotation(id: string) {
    await this.prisma.cropRotation.delete({ where: { id } });
    return { ok: true };
  }
}
