'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { naira, num } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import { FileUpload } from '@/components/file-upload';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Subsidiary {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  unitPrice: number;
  costPrice: number | null;
  quantityOnHand: number;
  reorderLevel: number;
  imageUrl: string | null;
  subsidiaryId: string | null;
  subsidiary: { id: string; name: string } | null;
}

export default function OnlineShopPage() {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');
  const [search, setSearch] = useState('');

  const productsQ = useQuery({
    queryKey: ['products', search],
    queryFn: () =>
      api.get<Product[]>(`/products${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
  const subsQ = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: () => api.get<Subsidiary[]>('/subsidiaries'),
    enabled: can('subsidiaries:read'),
  });

  const qc = useQueryClient();
  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.del(`/products/${id}`),
    onSuccess: async () => {
      toast.success('Product deleted');
      await qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Product>[] = [
    {
      header: 'Product',
      cell: (p) => (
        <div className="flex items-center gap-3">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl(p.imageUrl)}
              alt=""
              className="size-9 rounded-md border object-cover"
            />
          ) : (
            <div className="size-9 rounded-md border bg-muted" />
          )}
          <div>
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.sku ?? '—'}</div>
          </div>
        </div>
      ),
    },
    { header: 'Category', cell: (p) => p.category ?? '—' },
    {
      header: 'Price',
      cell: (p) => (
        <span>
          {naira(p.unitPrice)} <span className="text-xs text-muted-foreground">/ {p.unit}</span>
        </span>
      ),
    },
    ...(canSeeFinance
      ? [
          {
            header: 'Cost',
            cell: (p) => (p.costPrice != null ? naira(p.costPrice) : '—'),
          } satisfies Column<Product>,
        ]
      : []),
    {
      header: 'In stock',
      cell: (p) => (
        <span className="flex items-center gap-2">
          {num(p.quantityOnHand)} <span className="text-muted-foreground">{p.unit}</span>
          {p.quantityOnHand <= p.reorderLevel && <Badge variant="warning">Low</Badge>}
        </span>
      ),
    },
    { header: 'Subsidiary', cell: (p) => p.subsidiary?.name ?? '—' },
    {
      header: '',
      className: 'text-right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          {can('products:update') && (
            <ProductDialog
              product={p}
              subsidiaries={subsQ.data ?? []}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('products:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete"
              onClick={() => {
                if (confirm(`Delete "${p.name}"?`)) deleteProduct.mutate(p.id);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Online Shop" description="Product catalogue & stock levels">
        <ExportButton
          filename="products"
          rows={productsQ.data ?? []}
          columns={[
            { header: 'Name', value: (p) => p.name },
            { header: 'SKU', value: (p) => p.sku },
            { header: 'Category', value: (p) => p.category },
            { header: 'Unit', value: (p) => p.unit },
            { header: 'Unit price', value: (p) => p.unitPrice },
            ...(canSeeFinance
              ? [{ header: 'Cost price', value: (p: Product) => p.costPrice }]
              : []),
            { header: 'In stock', value: (p) => p.quantityOnHand },
            { header: 'Reorder level', value: (p) => p.reorderLevel },
            { header: 'Subsidiary', value: (p) => p.subsidiary?.name },
          ]}
        />
        {can('products:create') && (
          <ProductDialog
            subsidiaries={subsQ.data ?? []}
            trigger={
              <Button>
                <Plus className="size-4" /> New product
              </Button>
            }
          />
        )}
      </PageHeader>

      <div className="mb-4 relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="pl-8"
        />
      </div>

      <DataTable
        columns={columns}
        rows={productsQ.data ?? []}
        loading={productsQ.isLoading}
        empty="No products yet. Add your first product."
      />
    </div>
  );
}

function ProductDialog({
  product,
  subsidiaries,
  trigger,
}: {
  product?: Product;
  subsidiaries: Subsidiary[];
  trigger: React.ReactNode;
}) {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');
  const showCostInput = !product || canSeeFinance;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? '',
    unit: product?.unit ?? 'pcs',
    unitPrice: String(product?.unitPrice ?? ''),
    costPrice: String(product?.costPrice ?? ''),
    quantityOnHand: String(product?.quantityOnHand ?? '0'),
    reorderLevel: String(product?.reorderLevel ?? '0'),
    subsidiaryId: product?.subsidiaryId ?? '',
    imageUrl: product?.imageUrl ?? null,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name,
        sku: form.sku || null,
        category: form.category || null,
        unit: form.unit || 'pcs',
        unitPrice: Number(form.unitPrice || 0),
        quantityOnHand: Number(form.quantityOnHand || 0),
        reorderLevel: Number(form.reorderLevel || 0),
        subsidiaryId: form.subsidiaryId || null,
        imageUrl: form.imageUrl,
      };
      if (showCostInput) payload.costPrice = Number(form.costPrice || 0);
      return product
        ? api.patch(`/products/${product.id}`, payload)
        : api.post('/products', payload);
    },
    onSuccess: async () => {
      toast.success(product ? 'Product updated' : 'Product created');
      await qc.invalidateQueries({ queryKey: ['products'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'New product'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit of measure</Label>
            <Input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="e.g. pcs, kg, crate, bag"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Selling price (₦)</Label>
            <Input
              type="number"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
            />
          </div>
          {showCostInput && (
            <div className="space-y-1.5">
              <Label>Cost price (₦)</Label>
              <Input
                type="number"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Quantity on hand</Label>
            <Input
              type="number"
              value={form.quantityOnHand}
              onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reorder level</Label>
            <Input
              type="number"
              value={form.reorderLevel}
              onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Subsidiary</Label>
            <Select
              value={form.subsidiaryId}
              onChange={(e) => setForm({ ...form, subsidiaryId: e.target.value })}
            >
              <option value="">— None —</option>
              {subsidiaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Product image</Label>
            <FileUpload
              accept="image/*"
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              label="Upload image"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={form.name.trim().length < 1 || save.isPending}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {product ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
