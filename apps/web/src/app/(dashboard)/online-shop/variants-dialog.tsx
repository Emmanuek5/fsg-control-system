'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { naira, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  packSize: number;
  unitPrice: number;
  costPrice: number | null;
  quantityOnHand: number;
  availableUnits: number;
  reorderLevel: number;
  isDefault: boolean;
  isActive: boolean;
}

interface VariantDraft {
  name: string;
  sku: string;
  packSize: string;
  unitPrice: string;
  costPrice: string;
  quantityOnHand: string;
  reorderLevel: string;
  isDefault: boolean;
  isActive: boolean;
}

const emptyDraft: VariantDraft = {
  name: '',
  sku: '',
  packSize: '1',
  unitPrice: '',
  costPrice: '',
  quantityOnHand: '0',
  reorderLevel: '0',
  isDefault: false,
  isActive: true,
};

const toDraft = (v: ProductVariant): VariantDraft => ({
  name: v.name,
  sku: v.sku ?? '',
  packSize: String(v.packSize),
  unitPrice: String(v.unitPrice ?? ''),
  costPrice: String(v.costPrice ?? ''),
  quantityOnHand: String(v.quantityOnHand ?? '0'),
  reorderLevel: String(v.reorderLevel ?? '0'),
  isDefault: v.isDefault,
  isActive: v.isActive,
});

/**
 * Manage a product's variants — its pack sizes, bottle sizes or loose measures.
 *
 * Which fields matter depends on the parent's stock mode: a POOLED product
 * draws every variant from one pool, so `packSize` is the meaningful number and
 * per-variant stock is not editable. A PER_VARIANT product counts each variant
 * separately, so the reverse holds.
 */
export function VariantsDialog({
  productId,
  productName,
  unit,
  pooled,
  variants,
  trigger,
}: {
  productId: string;
  productName: string;
  unit: string;
  pooled: boolean;
  variants: ProductVariant[];
  trigger: React.ReactNode;
}) {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<VariantDraft>(emptyDraft);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['products'] });

  const payload = (d: VariantDraft) => {
    const body: Record<string, unknown> = {
      name: d.name.trim(),
      sku: d.sku.trim() || null,
      unitPrice: Number(d.unitPrice || 0),
      reorderLevel: Number(d.reorderLevel || 0),
      isDefault: d.isDefault,
      isActive: d.isActive,
    };
    if (canSeeFinance) body.costPrice = Number(d.costPrice || 0);
    if (pooled) body.packSize = Number(d.packSize || 1);
    else body.quantityOnHand = Number(d.quantityOnHand || 0);
    return body;
  };

  const reset = () => {
    setEditingId(null);
    setAdding(false);
    setDraft(emptyDraft);
  };

  const createVariant = useMutation({
    mutationFn: () => api.post(`/products/${productId}/variants`, payload(draft)),
    onSuccess: async () => {
      toast.success('Variant added');
      reset();
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not add variant'),
  });

  const updateVariant = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${productId}/variants/${id}`, payload(draft)),
    onSuccess: async () => {
      toast.success('Variant updated');
      reset();
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update variant'),
  });

  const deleteVariant = useMutation({
    mutationFn: (id: string) => api.del(`/products/${productId}/variants/${id}`),
    onSuccess: async () => {
      toast.success('Variant deleted');
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not delete variant'),
  });

  const busy = createVariant.isPending || updateVariant.isPending;

  const form = (onSave: () => void, saving: boolean) => (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Variant name</Label>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder={pooled ? `e.g. 3 ${unit} bag, Loose` : 'e.g. 500ml, Carton of 12'}
          maxLength={80}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label>SKU</Label>
        <Input
          value={draft.sku}
          onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
          maxLength={60}
        />
      </div>

      {pooled ? (
        <div className="space-y-1.5">
          <Label>Pack size ({unit} per unit sold)</Label>
          <Input
            type="number"
            min="0"
            step="any"
            value={draft.packSize}
            onChange={(e) => setDraft({ ...draft, packSize: e.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Quantity on hand</Label>
          <Input
            type="number"
            value={draft.quantityOnHand}
            onChange={(e) => setDraft({ ...draft, quantityOnHand: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Selling price (₦)</Label>
        <Input
          type="number"
          value={draft.unitPrice}
          onChange={(e) => setDraft({ ...draft, unitPrice: e.target.value })}
        />
      </div>
      {canSeeFinance && (
        <div className="space-y-1.5">
          <Label>Cost price (₦)</Label>
          <Input
            type="number"
            value={draft.costPrice}
            onChange={(e) => setDraft({ ...draft, costPrice: e.target.value })}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Reorder level</Label>
        <Input
          type="number"
          value={draft.reorderLevel}
          onChange={(e) => setDraft({ ...draft, reorderLevel: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-6 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={draft.isDefault}
            onCheckedChange={(v) => setDraft({ ...draft, isDefault: Boolean(v) })}
          />
          Default variant
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={draft.isActive}
            onCheckedChange={(v) => setDraft({ ...draft, isActive: Boolean(v) })}
          />
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" onClick={reset} disabled={saving}>
          <X className="size-4" /> Cancel
        </Button>
        <Button onClick={onSave} disabled={!draft.name.trim() || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{productName} — variants</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {pooled ? (
            <>
              Stock is one shared pool measured in <strong>{unit}</strong>. Each variant draws its
              pack size from that pool, so selling a 3&nbsp;{unit} pack takes 3&nbsp;{unit} out.
            </>
          ) : (
            <>Each variant is counted separately and cannot substitute for another.</>
          )}
        </p>

        <div className="max-h-[26rem] space-y-2 overflow-y-auto">
          {variants.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No variants yet.</p>
          )}

          {variants.map((v) =>
            editingId === v.id ? (
              <div key={v.id}>{form(() => updateVariant.mutate(v.id), updateVariant.isPending)}</div>
            ) : (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {v.name}
                    {v.isDefault && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="size-3" /> Default
                      </Badge>
                    )}
                    {!v.isActive && <Badge variant="outline">Inactive</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.sku ? `${v.sku} · ` : ''}
                    {pooled && `${num(v.packSize)} ${unit} each · `}
                    {naira(v.unitPrice)} · {num(v.availableUnits)} sellable
                    {v.reorderLevel > 0 && ` · reorder at ${num(v.reorderLevel)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {can('products:update') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${v.name}`}
                      onClick={() => {
                        setAdding(false);
                        setEditingId(v.id);
                        setDraft(toDraft(v));
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {can('products:delete') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label={`Delete ${v.name}`}
                      disabled={deleteVariant.isPending}
                      onClick={() => {
                        if (confirm(`Delete variant "${v.name}"?`)) deleteVariant.mutate(v.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ),
          )}

          {adding && form(() => createVariant.mutate(), createVariant.isPending)}
        </div>

        {can('products:create') && !adding && editingId === null && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setDraft({ ...emptyDraft, isActive: true });
              setAdding(true);
            }}
          >
            <Plus className="size-4" /> Add variant
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
