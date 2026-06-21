import { Injectable } from '@nestjs/common';
import type { CreateCropDto, UpdateCropDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CropsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.crop.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subsidiary: { select: { id: true, name: true } } },
    });
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
}
