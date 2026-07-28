/**
 * Flattening products and their variants into a single pick list.
 *
 * Every screen that acts on stock — recording a sale, a movement, a stock
 * request — needs to name one *variant*, not just a product. Presenting that
 * as two dependent dropdowns makes staff drill for something they already know
 * the name of, so instead each product/variant pair becomes one option:
 * "Big Bull Rice — 3 kg bag".
 */

export interface VariantOpt {
  id: string;
  name: string;
  packSize: number;
  unitPrice: number;
  availableUnits: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface ProductWithVariants {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  stockMode: 'PER_VARIANT' | 'POOLED';
  unitPrice: number;
  quantityOnHand: number;
  variants: VariantOpt[];
}

export interface SellableOpt {
  /** `${productId}:${variantId}` — stable key for form state and dedup. */
  key: string;
  productId: string;
  variantId: string;
  label: string;
  unit: string;
  unitPrice: number;
  available: number;
}

export const sellableKey = (productId: string, variantId: string) => `${productId}:${variantId}`;

export function buildSellables(products: ProductWithVariants[]): SellableOpt[] {
  return products.flatMap((product) =>
    (product.variants ?? [])
      .filter((variant) => variant.isActive)
      .map((variant) => ({
        key: sellableKey(product.id, variant.id),
        productId: product.id,
        variantId: variant.id,
        // A lone "Default" variant is an implementation detail, not something
        // to make staff read on every line.
        label:
          (product.variants ?? []).length === 1 && variant.isDefault
            ? product.name
            : `${product.name} — ${variant.name}`,
        unit: product.unit,
        // Variants start unpriced and inherit the product's price until
        // someone prices the pack sizes individually.
        unitPrice: variant.unitPrice > 0 ? variant.unitPrice : product.unitPrice,
        available: variant.availableUnits,
      })),
  );
}
