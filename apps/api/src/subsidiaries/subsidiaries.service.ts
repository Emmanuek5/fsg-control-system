import { Injectable } from '@nestjs/common';
import type { CreateSubsidiaryDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubsidiariesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.subsidiary.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateSubsidiaryDto) {
    return this.prisma.subsidiary.create({
      data: { name: dto.name, type: dto.type, description: dto.description ?? null },
    });
  }
}
