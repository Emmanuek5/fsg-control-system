import { Injectable } from '@nestjs/common';
import type { CreateCategoryDto, UpdateCategoryDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      productCount: category._count.products,
    }));
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: { name: dto.name, description: dto.description ?? null },
    });
  }

  update(id: string, dto: UpdateCategoryDto) {
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}
