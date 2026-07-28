import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  StockMode,
  type CreateProductDto,
  type CreateProductVariantDto,
  type UpdateProductDto,
  type UpdateProductVariantDto,
} from '@fsg/shared';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';
import { availableUnits, syncRollup } from '../inventory/stock';
import { PrismaService } from '../prisma/prisma.service';

const include = {
  subsidiary: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  variants: { orderBy: [{ isDefault: 'desc' }, { packSize: 'asc' }, { name: 'asc' }] },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Adds each variant's sellable count. For POOLED products that number is
   * derived from the shared pool, so the stored per-variant column would read
   * as a misleading zero without it.
   */
  private decorate(product: any, seesFinance: boolean) {
    return {
      ...product,
      costPrice: seesFinance ? product.costPrice : null,
      variants: (product.variants ?? []).map((variant: any) => ({
        ...variant,
        costPrice: seesFinance ? variant.costPrice : null,
        availableUnits: availableUnits(product, variant),
      })),
    };
  }

  async list(user: RequestUser, search?: string) {
    const [products, seesFinance] = await Promise.all([
      this.prisma.product.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
                { variants: { some: { name: { contains: search, mode: 'insensitive' } } } },
                {
                  category: {
                    is: { name: { contains: search, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : undefined,
        orderBy: { createdAt: 'desc' },
        include,
      }),
      this.permissions.roleHas(user.roleId, 'finance:read'),
    ]);
    return products.map((product) => this.decorate(product, seesFinance));
  }

  async get(user: RequestUser, id: string) {
    const [product, seesFinance] = await Promise.all([
      this.prisma.product.findUniqueOrThrow({ where: { id }, include }),
      this.permissions.roleHas(user.roleId, 'finance:read'),
    ]);
    return this.decorate(product, seesFinance);
  }

  /**
   * Creates the product and its variants together. When no variants are given
   * the product gets a single "Default" one carrying its price and stock, so
   * every product is immediately sellable and sales never have to special-case
   * a variant-less product.
   */
  async create(dto: CreateProductDto) {
    const pooled = dto.stockMode === StockMode.POOLED;
    const supplied = dto.variants?.length ? dto.variants : null;
    const variants: CreateProductVariantDto[] = supplied ?? [
      {
        name: 'Default',
        sku: dto.sku ?? null,
        packSize: 1,
        unitPrice: dto.unitPrice,
        costPrice: dto.costPrice,
        quantityOnHand: pooled ? 0 : (dto.quantityOnHand ?? 0),
        reorderLevel: dto.reorderLevel ?? 0,
        isDefault: true,
        isActive: true,
      },
    ];

    this.assertVariantNamesUnique(variants);
    const withDefault = this.withSingleDefault(variants);

    // POOLED: the product column is authoritative and already in base units.
    // PER_VARIANT: it is a rollup, so derive it from the variants themselves.
    const quantityOnHand = pooled
      ? (dto.quantityOnHand ?? 0)
      : withDefault.reduce((sum, v) => sum + (v.quantityOnHand ?? 0), 0);

    return this.prisma.product.create({
      data: {
        subsidiaryId: dto.subsidiaryId ?? null,
        name: dto.name,
        sku: dto.sku ?? null,
        categoryId: dto.categoryId ?? null,
        description: dto.description ?? null,
        unit: dto.unit ?? 'pcs',
        stockMode: dto.stockMode ?? StockMode.PER_VARIANT,
        unitPrice: dto.unitPrice,
        costPrice: dto.costPrice,
        quantityOnHand,
        reorderLevel: dto.reorderLevel ?? 0,
        imageUrl: dto.imageUrl ?? null,
        variants: {
          create: withDefault.map((v) => ({
            name: v.name,
            sku: v.sku ?? null,
            packSize: pooled ? (v.packSize ?? 1) : 1,
            unitPrice: v.unitPrice ?? dto.unitPrice,
            costPrice: v.costPrice ?? dto.costPrice,
            quantityOnHand: pooled ? 0 : (v.quantityOnHand ?? 0),
            reorderLevel: v.reorderLevel ?? 0,
            isDefault: v.isDefault ?? false,
            isActive: v.isActive ?? true,
          })),
        },
      },
      include,
    });
  }

  /**
   * Switching stock mode changes what the stock columns *mean*, so the counts
   * are converted rather than left to be reinterpreted:
   *   PER_VARIANT -> POOLED: the pool becomes the variants' combined base units.
   *   POOLED -> PER_VARIANT: the pool lands on the default variant.
   */
  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: { variants: true },
    });
    const nextMode = dto.stockMode ?? existing.stockMode;
    const modeChanged = nextMode !== existing.stockMode;

    return this.prisma.$transaction(async (tx) => {
      if (modeChanged && nextMode === StockMode.POOLED) {
        const pool = existing.variants.reduce(
          (sum, v) => sum + Math.round(v.quantityOnHand * v.packSize),
          0,
        );
        await tx.product.update({ where: { id }, data: { quantityOnHand: pool } });
        await tx.productVariant.updateMany({ where: { productId: id }, data: { quantityOnHand: 0 } });
      }

      if (modeChanged && nextMode === StockMode.PER_VARIANT) {
        const target =
          existing.variants.find((v) => v.isDefault) ?? existing.variants[0] ?? null;
        if (target) {
          await tx.productVariant.update({
            where: { id: target.id },
            data: { quantityOnHand: existing.quantityOnHand, packSize: 1 },
          });
        }
        await tx.productVariant.updateMany({
          where: { productId: id, NOT: { id: target?.id ?? '' } },
          data: { packSize: 1 },
        });
      }

      const { quantityOnHand, ...rest } = dto;
      await tx.product.update({
        where: { id },
        data: {
          ...rest,
          // A direct quantity edit only makes sense on a POOLED product; on a
          // PER_VARIANT one the rollup below owns the column.
          ...(quantityOnHand !== undefined && nextMode === StockMode.POOLED
            ? { quantityOnHand }
            : {}),
        },
      });

      await syncRollup(tx, id);
      return tx.product.findUniqueOrThrow({ where: { id }, include });
    });
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Variants ─────────────────────────────────────────────────────────────

  async addVariant(productId: string, dto: CreateProductVariantDto) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { variants: true },
    });
    if (product.variants.some((v) => v.name.toLowerCase() === dto.name.toLowerCase())) {
      throw new BadRequestException(`${product.name} already has a variant called "${dto.name}"`);
    }
    const pooled = product.stockMode === StockMode.POOLED;

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, productId);

      const variant = await tx.productVariant.create({
        data: {
          productId,
          name: dto.name,
          sku: dto.sku ?? null,
          packSize: pooled ? (dto.packSize ?? 1) : 1,
          unitPrice: dto.unitPrice ?? product.unitPrice,
          costPrice: dto.costPrice ?? product.costPrice,
          quantityOnHand: pooled ? 0 : (dto.quantityOnHand ?? 0),
          reorderLevel: dto.reorderLevel ?? 0,
          // First variant on a product is always the default.
          isDefault: dto.isDefault || product.variants.length === 0,
          isActive: dto.isActive ?? true,
        },
      });
      await syncRollup(tx, productId);
      return variant;
    });
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateProductVariantDto) {
    const [product, variant] = await Promise.all([
      this.prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      this.prisma.productVariant.findFirst({ where: { id: variantId, productId } }),
    ]);
    if (!variant) throw new NotFoundException('Variant not found on this product');
    const pooled = product.stockMode === StockMode.POOLED;

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, productId);

      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...dto,
          // packSize is meaningless off a pool; stock lives on the product there.
          ...(dto.packSize !== undefined ? { packSize: pooled ? dto.packSize : 1 } : {}),
          ...(dto.quantityOnHand !== undefined && pooled ? { quantityOnHand: 0 } : {}),
        },
      });
      await syncRollup(tx, productId);
      return updated;
    });
  }

  async removeVariant(productId: string, variantId: string) {
    const variants = await this.prisma.productVariant.findMany({ where: { productId } });
    const target = variants.find((v) => v.id === variantId);
    if (!target) throw new NotFoundException('Variant not found on this product');
    if (variants.length === 1) {
      throw new BadRequestException(
        'A product must keep at least one variant — edit this one instead of deleting it',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.delete({ where: { id: variantId } });
      // Deleting the default leaves the product without one; promote another.
      if (target.isDefault) {
        const next = variants.find((v) => v.id !== variantId)!;
        await tx.productVariant.update({ where: { id: next.id }, data: { isDefault: true } });
      }
      await syncRollup(tx, productId);
    });
    return { ok: true };
  }

  private clearDefault(tx: Prisma.TransactionClient, productId: string) {
    return tx.productVariant.updateMany({
      where: { productId, isDefault: true },
      data: { isDefault: false },
    });
  }

  private assertVariantNamesUnique(variants: CreateProductVariantDto[]) {
    const seen = new Set<string>();
    for (const v of variants) {
      const key = v.name.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate variant name: "${v.name}"`);
      }
      seen.add(key);
    }
  }

  /** Exactly one variant carries the default flag — the marked one, else the first. */
  private withSingleDefault(variants: CreateProductVariantDto[]): CreateProductVariantDto[] {
    const firstFlagged = variants.findIndex((v) => v.isDefault);
    const defaultIndex = firstFlagged === -1 ? 0 : firstFlagged;
    return variants.map((v, i) => ({ ...v, isDefault: i === defaultIndex }));
  }
}
