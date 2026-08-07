'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MovementType } from '@fsg/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime, naira, num } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import { FileUpload } from '@/components/file-upload';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { buildSellables, type ProductWithVariants } from '@/lib/sellables';

type ProductOpt = ProductWithVariants;
interface Movement {
  id: string;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  note: string | null;
  receiptUrl: string | null;
  occurredAt: string;
  product: { id: string; name: string; sku: string | null; unit: string } | null;
  variant: { id: string; name: string; packSize: number } | null;
  createdBy: { id: string; name: string } | null;
}

/** Movement rows name the variant unless it's the unremarkable lone default. */
const movementLabel = (m: Movement) =>
  m.variant && m.variant.name !== 'Default'
    ? `${m.product?.name ?? '—'} (${m.variant.name})`
    : (m.product?.name ?? '—');

const typeVariant: Record<MovementType, 'success' | 'destructive' | 'secondary'> = {
  IN: 'success',
  OUT: 'destructive',
  ADJUSTMENT: 'secondary',
};

export default function StockMovementsPage() {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');

  const movementsQ = useQuery({
    queryKey: ['movements'],
    queryFn: () => api.get<Movement[]>('/inventory-movements'),
  });
  const productsQ = useQuery({
    queryKey: ['products', ''],
    queryFn: () => api.get<ProductOpt[]>('/products'),
    enabled: can('products:read'),
  });

  const columns: Column<Movement>[] = [
    { header: 'Date', cell: (m) => fmtDateTime(m.occurredAt) },
    {
      header: 'Product',
      cell: (m) => (
        <div>
          <div className="font-medium">{movementLabel(m)}</div>
          <div className="text-xs text-muted-foreground">{m.product?.sku ?? ''}</div>
        </div>
      ),
    },
    { header: 'Type', cell: (m) => <Badge variant={typeVariant[m.type]}>{m.type}</Badge> },
    {
      header: 'Qty',
      cell: (m) => (
        <span>
          {num(m.quantity)} <span className="text-muted-foreground">{m.product?.unit ?? ''}</span>
        </span>
      ),
    },
    ...(canSeeFinance
      ? [
          {
            header: 'Unit cost',
            cell: (m) => (m.unitCost != null ? naira(m.unitCost) : '—'),
          } satisfies Column<Movement>,
        ]
      : []),
    { header: 'Reference', cell: (m) => m.reference ?? '—' },
    { header: 'By', cell: (m) => m.createdBy?.name ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        description="Stock in, out and adjustments across the shop"
      >
        <ExportButton
          filename="stock-movements"
          rows={movementsQ.data ?? []}
          columns={[
            { header: 'Date', value: (m) => new Date(m.occurredAt).toISOString() },
            { header: 'Product', value: (m) => movementLabel(m) },
            { header: 'Type', value: (m) => m.type },
            { header: 'Quantity', value: (m) => m.quantity },
            ...(canSeeFinance ? [{ header: 'Unit cost', value: (m: Movement) => m.unitCost }] : []),
            { header: 'Reference', value: (m) => m.reference },
            { header: 'By', value: (m) => m.createdBy?.name },
          ]}
        />
        {can('inventory:create') && <MovementDialog products={productsQ.data ?? []} />}
      </PageHeader>
      <DataTable
        columns={columns}
        rows={movementsQ.data ?? []}
        loading={movementsQ.isLoading}
        empty="No stock movements recorded yet."
      />
    </div>
  );
}

function MovementDialog({ products }: { products: ProductOpt[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const sellables = buildSellables(products);
  const sellableByKey = new Map(sellables.map((option) => [option.key, option]));
  const [form, setForm] = useState({
    sellableKey: '',
    type: MovementType.IN as MovementType,
    quantity: '',
    unitCost: '',
    reference: '',
    note: '',
    receiptUrl: null as string | null,
  });
  const selected = sellableByKey.get(form.sellableKey);

  const save = useMutation({
    mutationFn: () =>
      api.post('/inventory-movements', {
        productId: selected!.productId,
        variantId: selected!.variantId,
        type: form.type,
        quantity: Number(form.quantity || 0),
        unitCost: form.unitCost ? Number(form.unitCost) : null,
        reference: form.reference || null,
        note: form.note || null,
        receiptUrl: form.receiptUrl,
      }),
    onSuccess: async () => {
      toast.success('Movement recorded');
      await qc.invalidateQueries({ queryKey: ['movements'] });
      await qc.invalidateQueries({ queryKey: ['products'] });
      await qc.invalidateQueries({ queryKey: ['kpis'] });
      setOpen(false);
      setForm({
        sellableKey: '',
        type: MovementType.IN,
        quantity: '',
        unitCost: '',
        reference: '',
        note: '',
        receiptUrl: null,
      });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not record movement'),
  });

  const valid = Boolean(selected) && Number(form.quantity) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Record movement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record stock movement</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Product</Label>
            <Combobox
              aria-label="Product"
              value={form.sellableKey}
              onChange={(key) => setForm({ ...form, sellableKey: key })}
              options={sellables.map((option) => ({
                value: option.key,
                label: option.label,
                hint: `${num(option.available)} available`,
              }))}
              placeholder="Select a product…"
            />
            {selected && (
              <p className="text-xs text-muted-foreground">
                Quantities are counted in units of “{selected.label.split(' — ')[1] ?? 'this item'}”.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as MovementType })}
            >
              <option value="IN">Stock In</option>
              <option value="OUT">Stock Out</option>
              <option value="ADJUSTMENT">Adjustment (set total)</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit cost (₦)</Label>
            <Input
              type="number"
              value={form.unitCost}
              onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="e.g. Supplier invoice #"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Note</Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Receipt</Label>
            <FileUpload
              accept="image/*,application/pdf"
              value={form.receiptUrl}
              onChange={(url) => setForm({ ...form, receiptUrl: url })}
              label="Upload receipt"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
