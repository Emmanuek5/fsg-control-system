'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate, naira, num, toDateInput } from '@/lib/format';
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

interface Plot {
  id: string;
  name: string;
  location: string | null;
  sizeAcres: number;
  purchasePrice: number;
  totalDue: number;
  titleDocUrl: string | null;
  acquisitionDate: string | null;
  status: string;
  paidTotal: number;
  balance: number;
}
interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  reference: string | null;
}

const statusVariant: Record<string, 'success' | 'warning' | 'secondary'> = {
  OWNED: 'success',
  FINANCING: 'warning',
  LEASED: 'secondary',
};

export default function LandEstatePage() {
  const { can } = useAuth();
  const qc = useQueryClient();

  const plotsQ = useQuery({ queryKey: ['land-plots'], queryFn: () => api.get<Plot[]>('/land/plots') });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/land/plots/${id}`),
    onSuccess: async () => {
      toast.success('Plot deleted');
      await qc.invalidateQueries({ queryKey: ['land-plots'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Plot>[] = [
    {
      header: 'Plot',
      cell: (p) => (
        <div>
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">{p.location ?? '—'}</div>
        </div>
      ),
    },
    { header: 'Size (acres)', cell: (p) => num(p.sizeAcres) },
    { header: 'Total due', cell: (p) => naira(p.totalDue) },
    { header: 'Paid', cell: (p) => naira(p.paidTotal) },
    {
      header: 'Balance',
      cell: (p) =>
        p.balance > 0 ? <Badge variant="warning">{naira(p.balance)}</Badge> : <Badge variant="success">Cleared</Badge>,
    },
    { header: 'Status', cell: (p) => <Badge variant={statusVariant[p.status] ?? 'secondary'}>{p.status}</Badge> },
    {
      header: '',
      className: 'text-right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          {can('land:read') && (
            <PaymentsDialog
              plot={p}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Payments">
                  <Banknote className="size-4" />
                </Button>
              }
            />
          )}
          {can('land:update') && (
            <PlotDialog
              plot={p}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('land:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete"
              onClick={() => {
                if (confirm(`Delete "${p.name}"?`)) remove.mutate(p.id);
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
      <PageHeader title="Land & Estate" description="Land plots, title documents and payment schedules">
        <ExportButton
          filename="land-plots"
          rows={plotsQ.data ?? []}
          columns={[
            { header: 'Plot', value: (p) => p.name },
            { header: 'Location', value: (p) => p.location },
            { header: 'Size (acres)', value: (p) => p.sizeAcres },
            { header: 'Total due', value: (p) => p.totalDue },
            { header: 'Paid', value: (p) => p.paidTotal },
            { header: 'Balance', value: (p) => p.balance },
            { header: 'Status', value: (p) => p.status },
          ]}
        />
        {can('land:create') && (
          <PlotDialog
            trigger={
              <Button>
                <Plus className="size-4" /> New plot
              </Button>
            }
          />
        )}
      </PageHeader>
      <DataTable columns={columns} rows={plotsQ.data ?? []} loading={plotsQ.isLoading} empty="No land plots yet." />
    </div>
  );
}

function PlotDialog({ plot, trigger }: { plot?: Plot; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: plot?.name ?? '',
    location: plot?.location ?? '',
    sizeAcres: String(plot?.sizeAcres ?? ''),
    purchasePrice: String(plot?.purchasePrice ?? ''),
    totalDue: String(plot?.totalDue ?? ''),
    acquisitionDate: toDateInput(plot?.acquisitionDate),
    status: plot?.status ?? 'OWNED',
    titleDocUrl: plot?.titleDocUrl ?? null,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        location: form.location || null,
        sizeAcres: Number(form.sizeAcres || 0),
        purchasePrice: Number(form.purchasePrice || 0),
        totalDue: Number(form.totalDue || 0),
        acquisitionDate: form.acquisitionDate || null,
        status: form.status,
        titleDocUrl: form.titleDocUrl,
      };
      return plot ? api.patch(`/land/plots/${plot.id}`, payload) : api.post('/land/plots', payload);
    },
    onSuccess: async () => {
      toast.success(plot ? 'Plot updated' : 'Plot created');
      await qc.invalidateQueries({ queryKey: ['land-plots'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plot ? 'Edit plot' : 'New plot'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Plot name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Size (acres)</Label>
            <Input
              type="number"
              value={form.sizeAcres}
              onChange={(e) => setForm({ ...form, sizeAcres: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Purchase price (₦)</Label>
            <Input
              type="number"
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Total due (₦)</Label>
            <Input
              type="number"
              value={form.totalDue}
              onChange={(e) => setForm({ ...form, totalDue: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Acquisition date</Label>
            <Input
              type="date"
              value={form.acquisitionDate}
              onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="OWNED">Owned</option>
              <option value="FINANCING">Financing</option>
              <option value="LEASED">Leased</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Title document</Label>
            <FileUpload
              accept="image/*,application/pdf"
              value={form.titleDocUrl}
              onChange={(url) => setForm({ ...form, titleDocUrl: url })}
              label="Upload title doc"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={form.name.trim().length < 1 || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {plot ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsDialog({ plot, trigger }: { plot: Plot; trigger: React.ReactNode }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', paidAt: toDateInput(new Date()), method: '', reference: '' });

  const paymentsQ = useQuery({
    queryKey: ['land-payments', plot.id],
    queryFn: () => api.get<Payment[]>(`/land/plots/${plot.id}/payments`),
    enabled: open,
  });

  const add = useMutation({
    mutationFn: () =>
      api.post('/land/payments', {
        plotId: plot.id,
        amount: Number(form.amount || 0),
        paidAt: form.paidAt,
        method: form.method || null,
        reference: form.reference || null,
      }),
    onSuccess: async () => {
      toast.success('Payment recorded');
      await qc.invalidateQueries({ queryKey: ['land-payments', plot.id] });
      await qc.invalidateQueries({ queryKey: ['land-plots'] });
      setForm({ amount: '', paidAt: toDateInput(new Date()), method: '', reference: '' });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Payments — {plot.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Paid {naira(plot.paidTotal)} of {naira(plot.totalDue)} · balance{' '}
          <span className="font-medium text-foreground">{naira(plot.balance)}</span>
        </p>

        <div className="max-h-56 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="p-2">Date</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Method</th>
                <th className="p-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {paymentsQ.isLoading ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : (paymentsQ.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                paymentsQ.data!.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-2">{fmtDate(p.paidAt)}</td>
                    <td className="p-2">{naira(p.amount)}</td>
                    <td className="p-2">{p.method ?? '—'}</td>
                    <td className="p-2">{p.reference ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {can('land:create') && (
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Amount (₦)</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={() => add.mutate()} disabled={Number(form.amount) <= 0 || add.isPending} className="w-full">
                {add.isPending && <Loader2 className="size-4 animate-spin" />}
                Record payment
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
