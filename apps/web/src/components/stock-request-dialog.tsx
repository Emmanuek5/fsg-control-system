'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MovementType } from '@fsg/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { num } from '@/lib/format';
import { buildSellables, sellableKey, type ProductWithVariants } from '@/lib/sellables';
import { FileUpload } from '@/components/file-upload';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Subsidiary { id: string; name: string; }

/** The fields an existing request needs to prefill the edit form. */
export interface EditableStockRequest {
  id: string;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  note: string | null;
  receiptUrl?: string | null;
  product: { id: string };
  variant: { id: string } | null;
  subsidiary: { id: string } | null;
}

/**
 * Create or edit a stock request. Editing a needs-info request resets it to
 * pending on the server, so saving doubles as "resubmit for approval".
 */
export function StockRequestDialog({ request, trigger }: { request?: EditableStockRequest; trigger: ReactNode }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const editing = Boolean(request);

  const productsQ = useQuery({ queryKey: ['products', 'stock-requests'], queryFn: () => api.get<ProductWithVariants[]>('/products'), enabled: open && can('products:read') });
  const subsQ = useQuery({ queryKey: ['subsidiaries'], queryFn: () => api.get<Subsidiary[]>('/subsidiaries'), enabled: open && can('subsidiaries:read') });

  const emptyForm = { sellableKey: '', subsidiaryId: '', type: MovementType.IN as MovementType, quantity: '', unitCost: '', reference: '', note: '', receiptUrl: null as string | null };
  const initialForm = request
    ? {
        sellableKey: request.variant ? sellableKey(request.product.id, request.variant.id) : '',
        subsidiaryId: request.subsidiary?.id ?? '',
        type: request.type,
        quantity: String(request.quantity),
        unitCost: request.unitCost != null ? String(request.unitCost) : '',
        reference: request.reference ?? '',
        note: request.note ?? '',
        receiptUrl: request.receiptUrl ?? null,
      }
    : emptyForm;
  const [form, setForm] = useState(initialForm);

  const sellables = buildSellables(productsQ.data ?? []);
  const selected = sellables.find((option) => option.key === form.sellableKey);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        productId: selected!.productId,
        variantId: selected!.variantId,
        subsidiaryId: form.subsidiaryId || null,
        type: form.type,
        quantity: Number(form.quantity || 0),
        unitCost: form.unitCost ? Number(form.unitCost) : null,
        reference: form.reference || null,
        note: form.note || null,
        receiptUrl: form.receiptUrl,
      };
      return request ? api.patch(`/stock-requests/${request.id}`, payload) : api.post('/stock-requests', payload);
    },
    onSuccess: async () => {
      toast.success(editing ? 'Request updated and resubmitted for approval' : 'Stock request submitted');
      await qc.invalidateQueries({ queryKey: ['stock-requests'] });
      if (request) await qc.invalidateQueries({ queryKey: ['stock-request', request.id] });
      await qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      setOpen(false);
      if (!editing) setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save request'),
  });

  const valid = Boolean(selected) && Number(form.quantity) > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setForm(initialForm);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Edit stock request' : 'New stock request'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Product</Label>
            <Combobox
              aria-label="Product"
              value={form.sellableKey}
              onChange={(key) => setForm({ ...form, sellableKey: key })}
              options={sellables.map((option) => ({ value: option.key, label: option.label, hint: `${num(option.available)} available` }))}
              placeholder={productsQ.isLoading ? 'Loading products…' : 'Select product'}
            />
          </div>
          <div className="space-y-1.5"><Label>Zone</Label><Select value={form.subsidiaryId} onChange={(e) => setForm({ ...form, subsidiaryId: e.target.value })}><option value="">General</option>{(subsQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MovementType })}><option value="IN">Stock In</option><option value="OUT">Stock Out</option><option value="ADJUSTMENT">Adjustment</option></Select></div>
          <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Unit cost</Label><Input type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Reason / note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Attachment</Label><FileUpload accept="image/*,application/pdf" value={form.receiptUrl} onChange={(url) => setForm({ ...form, receiptUrl: url })} label="Upload supporting file" /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {editing ? 'Save & resubmit' : 'Submit request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
