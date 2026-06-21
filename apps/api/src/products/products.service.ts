import { Injectable } from '@nestjs/common';
import type { CreateProductDto, UpdateProductDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string) {
    return this.prisma.product.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: { subsidiary: { select: { id: true, name: true } } },
    });
  }

  get(id: string) {
    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: { subsidiary: { select: { id: true, name: true } } },
    });
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        subsidiaryId: dto.subsidiaryId ?? null,
        name: dto.name,
        sku: dto.sku ?? null,
        category: dto.category ?? null,
        description: dto.description ?? null,
        unit: dto.unit ?? 'pcs',
        unitPrice: dto.unitPrice,
        costPrice: dto.costPrice,
        quantityOnHand: dto.quantityOnHand ?? 0,
        reorderLevel: dto.reorderLevel ?? 0,
        imageUrl: dto.imageUrl ?? null,
      },
    });
  }

  update(id: string, dto: UpdateProductDto) {
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }
}
