'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MovementType, type ApprovalStatus } from '@fsg/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime, naira, num } from '@/lib/format';
import { movementLabel, statusLabel, statusVariant } from '@/lib/approval';
import { buildSellables, type ProductWithVariants } from '@/lib/sellables';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FileUpload } from '@/components/file-upload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type ProductOpt = ProductWithVariants;
interface Subsidiary { id: string; name: string; }
interface StockRequest {
  id: string;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  status: ApprovalStatus;
  createdAt: string;
  product: { id: string; name: string; sku: string | null; unit: string; quantityOnHand: number };
  variant: { id: string; name: string; packSize: number; quantityOnHand: number } | null;
  subsidiary: { id: string; name: string } | null;
  requestedBy: { id: string; name: string; email: string } | null;
}

export default function StockRequestsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const requestsQ = useQuery({
    queryKey: ['stock-requests', status],
    queryFn: () => api.get<StockRequest[]>(`/stock-requests${status ? `?status=${status}` : ''}`),
  });
  const productsQ = useQuery({ queryKey: ['products', 'stock-requests'], queryFn: () => api.get<ProductOpt[]>('/products'), enabled: can('products:read') });
  const subsQ = useQuery({ queryKey: ['subsidiaries'], queryFn: () => api.get<Subsidiary[]>('/subsidiaries'), enabled: can('subsidiaries:read') });

  const columns: Column<StockRequest>[] = [
    { header: 'Date', cell: (r) => fmtDateTime(r.createdAt) },
    { header: 'Product', cell: (r) => <div><div className="font-medium">{r.product.name}</div><div className="text-xs text-muted-foreground">{r.variant && r.variant.name !== 'Default' ? r.variant.name : (r.product.sku ?? 'No SKU')}</div></div> },
    { header: 'Type', cell: (r) => movementLabel[r.type] },
    { header: 'Quantity', cell: (r) => `${num(r.quantity)} ${r.product.unit}` },
    { header: 'Unit cost', cell: (r) => r.unitCost != null ? naira(r.unitCost) : '-' },
    { header: 'Requester', cell: (r) => r.requestedBy?.name ?? '-' },
    { header: 'Status', cell: (r) => <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge> },
    { header: '', className: 'text-right', cell: (r) => <Button variant="ghost" size="icon" asChild aria-label="Open request"><Link href={`/stock-requests/${r.id}`}><Eye className="size-4" /></Link></Button> },
  ];

  return (
    <div>
      <PageHeader title="Stock Requests" description="Request stock changes for manager approval before inventory is affected">
        {can('stock_requests:create') && <StockRequestDialog products={productsQ.data ?? []} subsidiaries={subsQ.data ?? []} />}
      </PageHeader>
      <div className="mb-4 max-w-xs">
        <Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All requests</option>
          <option value="PENDING">Pending</option>
          <option value="NEEDS_INFO">Needs info</option>
          <option value="APPROVED">Approved</option>
          <option value="DENIED">Denied</option>
        </Select>
      </div>
      <DataTable columns={columns} rows={requestsQ.data ?? []} loading={requestsQ.isLoading} empty="No stock requests yet." />
    </div>
  );
}

function StockRequestDialog({ products, subsidiaries }: { products: ProductOpt[]; subsidiaries: Subsidiary[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const sellables = buildSellables(products);
  const sellableByKey = new Map(sellables.map((option) => [option.key, option]));
  const [form, setForm] = useState({ sellableKey: '', subsidiaryId: '', type: MovementType.IN as MovementType, quantity: '', unitCost: '', reference: '', note: '', receiptUrl: null as string | null });
  const selected = sellableByKey.get(form.sellableKey);
  const save = useMutation({
    mutationFn: () => api.post('/stock-requests', { productId: selected!.productId, variantId: selected!.variantId, subsidiaryId: form.subsidiaryId || null, type: form.type, quantity: Number(form.quantity || 0), unitCost: form.unitCost ? Number(form.unitCost) : null, reference: form.reference || null, note: form.note || null, receiptUrl: form.receiptUrl }),
    onSuccess: async () => {
      toast.success('Stock request submitted');
      await qc.invalidateQueries({ queryKey: ['stock-requests'] });
      await qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      setOpen(false);
      setForm({ sellableKey: '', subsidiaryId: '', type: MovementType.IN, quantity: '', unitCost: '', reference: '', note: '', receiptUrl: null });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not submit request'),
  });
  const valid = Boolean(selected) && Number(form.quantity) > 0;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" /> New request</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New stock request</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Product</Label><Select value={form.sellableKey} onChange={(e) => setForm({ ...form, sellableKey: e.target.value })}><option value="">Select product</option>{sellables.map((option) => <option key={option.key} value={option.key}>{option.label} ({num(option.available)} available)</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Zone</Label><Select value={form.subsidiaryId} onChange={(e) => setForm({ ...form, subsidiaryId: e.target.value })}><option value="">General</option>{subsidiaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MovementType })}><option value="IN">Stock In</option><option value="OUT">Stock Out</option><option value="ADJUSTMENT">Adjustment</option></Select></div>
          <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Unit cost</Label><Input type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Reason / note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Attachment</Label><FileUpload accept="image/*,application/pdf" value={form.receiptUrl} onChange={(url) => setForm({ ...form, receiptUrl: url })} label="Upload supporting file" /></div>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />}Submit request</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
