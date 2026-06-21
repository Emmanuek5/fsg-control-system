import { Injectable } from '@nestjs/common';
import type { CreateLivestockDto, UpdateLivestockDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LivestockService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.livestock.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subsidiary: { select: { id: true, name: true } } },
    });
  }

  create(dto: CreateLivestockDto) {
    return this.prisma.livestock.create({ data: { ...dto, subsidiaryId: dto.subsidiaryId ?? null } });
  }

  update(id: string, dto: UpdateLivestockDto) {
    return this.prisma.livestock.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.livestock.delete({ where: { id } });
    return { ok: true };
  }
}
