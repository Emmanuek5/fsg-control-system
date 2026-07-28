import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MovementType, StockMode } from '@fsg/shared';

/**
 * Stock arithmetic for variant-aware products.
 *
 * Every quantity crossing this module's surface is counted in *variant units*
 * — 2 means two 3 kg bags, not 6 kg. Conversion to the base unit happens here
 * and nowhere else, so sales, inventory and stock requests cannot drift apart
 * on the rules.
 *
 * Two modes, per product:
 *
 *   PER_VARIANT — the variant's own `quantityOnHand` is authoritative, and the
 *   product's is a rollup kept in step on every write.
 *
 *   POOLED — the product's `quantityOnHand` is authoritative and measured in
 *   the base unit; a variant's availability is derived by dividing the pool by
 *   its `packSize`. The variant's own count is ignored entirely.
 */

/**
 * The product fields stock operations need — plus price and subsidiary, which
 * callers resolving a line (a sale, a stock request) invariably want and would
 * otherwise have to re-query for.
 */
export interface StockProduct {
  id: string;
  name: string;
  unit: string;
  stockMode: StockMode;
  quantityOnHand: number;
  unitPrice: number;
  costPrice: number;
  subsidiaryId: string | null;
}

/** The matching slice of a variant. */
export interface StockVariant {
  id: string;
  name: string;
  packSize: number;
  quantityOnHand: number;
  unitPrice: number;
  costPrice: number;
}

export interface ResolvedStock {
  product: StockProduct;
  variant: StockVariant;
}

/** Selects exactly the columns {@link StockProduct} and {@link StockVariant} declare. */
export const stockProductSelect = {
  id: true,
  name: true,
  unit: true,
  stockMode: true,
  quantityOnHand: true,
  unitPrice: true,
  costPrice: true,
  subsidiaryId: true,
} satisfies Prisma.ProductSelect;

export const stockVariantSelect = {
  id: true,
  name: true,
  packSize: true,
  quantityOnHand: true,
  unitPrice: true,
  costPrice: true,
} satisfies Prisma.ProductVariantSelect;

/**
 * What a sale should charge for one unit of this variant: the variant's own
 * price, falling back to the product's when the variant has none set (which is
 * the state every product lands in before someone prices its pack sizes).
 */
export function effectiveUnitPrice({ product, variant }: ResolvedStock): number {
  return variant.unitPrice > 0 ? variant.unitPrice : product.unitPrice;
}

type Tx = Prisma.TransactionClient;

/**
 * Base units consumed by `units` of this variant.
 *
 * `packSize` is a float so half-measures can be expressed, but stock columns
 * are integers — the result is rounded, which is exact for the whole-number
 * pack sizes real products use and predictable for the rest.
 */
export function toBaseUnits(variant: StockVariant, units: number): number {
  return Math.round(units * variant.packSize);
}

/** How many units of `variant` can be sold right now. */
export function availableUnits(product: StockProduct, variant: StockVariant): number {
  if (product.stockMode === StockMode.POOLED) {
    if (variant.packSize <= 0) return 0;
    return Math.floor(product.quantityOnHand / variant.packSize);
  }
  return variant.quantityOnHand;
}

/**
 * Load a product and the variant to act on. `variantId` is optional — callers
 * that don't care (legacy clients, single-variant products) get the default.
 */
export async function resolveStock(
  tx: Tx,
  productId: string,
  variantId?: string | null,
): Promise<ResolvedStock> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: stockProductSelect,
  });
  if (!product) throw new NotFoundException(`Product not found: ${productId}`);

  const variant = variantId
    ? await tx.productVariant.findFirst({
        where: { id: variantId, productId },
        select: stockVariantSelect,
      })
    : await defaultVariant(tx, productId);

  if (!variant) {
    throw new NotFoundException(
      variantId
        ? `Variant ${variantId} does not belong to ${product.name}`
        : `${product.name} has no variants`,
    );
  }
  return { product, variant };
}

/**
 * The variant to use when none was named: the one flagged default, else the
 * oldest. Products always have at least one, but a variant can be deleted
 * while another is being made default, so the fallback matters.
 */
export async function defaultVariant(tx: Tx, productId: string) {
  return (
    (await tx.productVariant.findFirst({
      where: { productId, isDefault: true },
      select: stockVariantSelect,
    })) ??
    (await tx.productVariant.findFirst({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      select: stockVariantSelect,
    }))
  );
}

/**
 * Take `units` out of stock, or throw if they aren't there.
 *
 * The decrement is conditional — the row is only claimed when the stock is
 * still present — so two concurrent sales can never oversell the same product.
 */
export async function claimStock(
  tx: Tx,
  { product, variant }: ResolvedStock,
  units: number,
): Promise<void> {
  if (units <= 0) return;

  if (product.stockMode === StockMode.POOLED) {
    const base = toBaseUnits(variant, units);
    const claimed = await tx.product.updateMany({
      where: { id: product.id, quantityOnHand: { gte: base } },
      data: { quantityOnHand: { decrement: base } },
    });
    if (claimed.count === 0) throw shortfall(product, variant, units);
    return;
  }

  const claimed = await tx.productVariant.updateMany({
    where: { id: variant.id, quantityOnHand: { gte: units } },
    data: { quantityOnHand: { decrement: units } },
  });
  if (claimed.count === 0) throw shortfall(product, variant, units);
  await syncRollup(tx, product.id);
}

/** Put `units` back — a reversed sale, or an inbound movement. */
export async function releaseStock(
  tx: Tx,
  { product, variant }: ResolvedStock,
  units: number,
): Promise<void> {
  if (units <= 0) return;

  if (product.stockMode === StockMode.POOLED) {
    await tx.product.update({
      where: { id: product.id },
      data: { quantityOnHand: { increment: toBaseUnits(variant, units) } },
    });
    return;
  }

  await tx.productVariant.update({
    where: { id: variant.id },
    data: { quantityOnHand: { increment: units } },
  });
  await syncRollup(tx, product.id);
}

/**
 * Apply an inventory movement. IN adds, OUT removes (floored at zero, matching
 * the pre-variant behaviour), ADJUSTMENT sets the absolute count.
 *
 * OUT here deliberately does *not* use {@link claimStock}: a stock movement is
 * a correction of the books by someone who can see the shelf, so it is allowed
 * to drive stock to zero rather than failing. Sales use claimStock.
 */
export async function applyMovement(
  tx: Tx,
  resolved: ResolvedStock,
  type: MovementType,
  units: number,
): Promise<void> {
  const { product, variant } = resolved;

  if (product.stockMode === StockMode.POOLED) {
    const base = toBaseUnits(variant, units);
    const current = product.quantityOnHand;
    const next =
      type === MovementType.IN
        ? current + base
        : type === MovementType.OUT
          ? Math.max(0, current - base)
          : base;
    await tx.product.update({ where: { id: product.id }, data: { quantityOnHand: next } });
    return;
  }

  const current = variant.quantityOnHand;
  const next =
    type === MovementType.IN
      ? current + units
      : type === MovementType.OUT
        ? Math.max(0, current - units)
        : units;
  await tx.productVariant.update({ where: { id: variant.id }, data: { quantityOnHand: next } });
  await syncRollup(tx, product.id);
}

/**
 * Rewrite a PER_VARIANT product's `quantityOnHand` as the sum of its variants,
 * so list views, dashboards and low-stock alerts can read one number without
 * joining. No-op for POOLED products, where the product column is the source
 * of truth and the variants' counts are meaningless.
 */
export async function syncRollup(tx: Tx, productId: string): Promise<void> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stockMode: true },
  });
  if (!product || product.stockMode === StockMode.POOLED) return;

  const total = await tx.productVariant.aggregate({
    where: { productId },
    _sum: { quantityOnHand: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { quantityOnHand: total._sum.quantityOnHand ?? 0 },
  });
}

function shortfall(product: StockProduct, variant: StockVariant, wanted: number) {
  const have = availableUnits(product, variant);
  const label = `${product.name} (${variant.name})`;
  const detail =
    product.stockMode === StockMode.POOLED
      ? `${product.quantityOnHand} ${product.unit} in the pool covers ${have}, not ${wanted}`
      : `only ${have} available, not ${wanted}`;
  return new BadRequestException(`Insufficient stock for ${label}: ${detail}`);
}
