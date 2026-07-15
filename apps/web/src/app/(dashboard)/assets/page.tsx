'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate, naira, toDateInput } from '@/lib/format';
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
interface Asset {
  id: string;
  name: string;
  category: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  currentValue: number | null;
  condition: string;
  location: string | null;
  imageUrl: string | null;
  status: string;
  subsidiaryId: string | null;
  overdueCount: number;
}
interface MaintenanceLog {
  id: string;
  type: string | null;
  scheduledDate: string;
  completedDate: string | null;
  cost: number | null;
  vendor: string | null;
  status: string;
  isOverdue: boolean;
}

const statusVariant: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  ACTIVE: 'success',
  IN_REPAIR: 'warning',
  RETIRED: 'secondary',
  DISPOSED: 'destructive',
};

export default function AssetsPage() {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');
  const qc = useQueryClient();

  const assetsQ = useQuery({ queryKey: ['assets'], queryFn: () => api.get<Asset[]>('/assets') });
  const subsQ = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: () => api.get<Subsidiary[]>('/subsidiaries'),
    enabled: can('subsidiaries:read'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/assets/${id}`),
    onSuccess: async () => {
      toast.success('Asset deleted');
      await qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Asset>[] = [
    {
      header: 'Asset',
      cell: (a) => (
        <div>
          <div className="font-medium">{a.name}</div>
          <div className="text-xs text-muted-foreground">{a.category ?? '—'}</div>
        </div>
      ),
    },
    ...(canSeeFinance
      ? [
          {
            header: 'Purchase',
            cell: (a) => (a.purchaseCost != null ? naira(a.purchaseCost) : '—'),
          } satisfies Column<Asset>,
          {
            header: 'Value',
            cell: (a) => (a.currentValue != null ? naira(a.currentValue) : '—'),
          } satisfies Column<Asset>,
        ]
      : []),
    { header: 'Condition', cell: (a) => a.condition },
    {
      header: 'Status',
      cell: (a) => (
        <span className="flex items-center gap-2">
          <Badge variant={statusVariant[a.status] ?? 'secondary'}>{a.status}</Badge>
          {a.overdueCount > 0 && <Badge variant="destructive">{a.overdueCount} overdue</Badge>}
        </span>
      ),
    },
    {
      header: '',
      className: 'text-right',
      cell: (a) => (
        <div className="flex justify-end gap-1">
          {can('maintenance:read') && (
            <MaintenanceDialog
              asset={a}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Maintenance">
                  <Wrench className="size-4" />
                </Button>
              }
            />
          )}
          {can('assets:update') && (
            <AssetDialog
              asset={a}
              subsidiaries={subsQ.data ?? []}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('assets:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete"
              onClick={() => {
                if (confirm(`Delete "${a.name}"?`)) remove.mutate(a.id);
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
      <PageHeader title="Assets" description="Company assets, valuations and maintenance">
        <ExportButton
          filename="assets"
          rows={assetsQ.data ?? []}
          columns={[
            { header: 'Name', value: (a) => a.name },
            { header: 'Category', value: (a) => a.category },
            { header: 'Serial', value: (a) => a.serialNumber },
            ...(canSeeFinance
              ? [
                  { header: 'Purchase cost', value: (a: Asset) => a.purchaseCost },
                  { header: 'Current value', value: (a: Asset) => a.currentValue },
                ]
              : []),
            { header: 'Condition', value: (a) => a.condition },
            { header: 'Status', value: (a) => a.status },
            { header: 'Overdue maintenance', value: (a) => a.overdueCount },
          ]}
        />
        {can('assets:create') && (
          <AssetDialog
            subsidiaries={subsQ.data ?? []}
            trigger={
              <Button>
                <Plus className="size-4" /> New asset
              </Button>
            }
          />
        )}
      </PageHeader>
      <DataTable
        columns={columns}
        rows={assetsQ.data ?? []}
        loading={assetsQ.isLoading}
        empty="No assets yet."
      />
    </div>
  );
}

function AssetDialog({
  asset,
  subsidiaries,
  trigger,
}: {
  asset?: Asset;
  subsidiaries: Subsidiary[];
  trigger: React.ReactNode;
}) {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');
  const showValueInputs = !asset || canSeeFinance;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: asset?.name ?? '',
    category: asset?.category ?? '',
    serialNumber: asset?.serialNumber ?? '',
    purchaseDate: toDateInput(asset?.purchaseDate),
    purchaseCost: String(asset?.purchaseCost ?? ''),
    currentValue: String(asset?.currentValue ?? ''),
    condition: asset?.condition ?? 'GOOD',
    location: asset?.location ?? '',
    status: asset?.status ?? 'ACTIVE',
    subsidiaryId: asset?.subsidiaryId ?? '',
    imageUrl: asset?.imageUrl ?? null,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name,
        category: form.category || null,
        serialNumber: form.serialNumber || null,
        purchaseDate: form.purchaseDate || null,
        condition: form.condition,
        location: form.location || null,
        status: form.status,
        subsidiaryId: form.subsidiaryId || null,
        imageUrl: form.imageUrl,
      };
      if (showValueInputs) {
        payload.purchaseCost = Number(form.purchaseCost || 0);
        payload.currentValue = Number(form.currentValue || 0);
      }
      return asset ? api.patch(`/assets/${asset.id}`, payload) : api.post('/assets', payload);
    },
    onSuccess: async () => {
      toast.success(asset ? 'Asset updated' : 'Asset created');
      await qc.invalidateQueries({ queryKey: ['assets'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset ? 'Edit asset' : 'New asset'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Serial number</Label>
            <Input
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Purchase date</Label>
            <Input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Purchase cost (₦)</Label>
            <Input
              type="number"
              value={form.purchaseCost}
              onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Current value (₦)</Label>
            <Input
              type="number"
              value={form.currentValue}
              onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Condition</Label>
            <Select
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
            >
              <option value="NEW">New</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="IN_REPAIR">In repair</option>
              <option value="RETIRED">Retired</option>
              <option value="DISPOSED">Disposed</option>
            </Select>
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
            <Label>Asset image</Label>
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
            {asset ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceDialog({ asset, trigger }: { asset: Asset; trigger: React.ReactNode }) {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: '',
    scheduledDate: toDateInput(new Date()),
    cost: '',
    vendor: '',
  });

  const logsQ = useQuery({
    queryKey: ['maintenance', asset.id],
    queryFn: () => api.get<MaintenanceLog[]>(`/maintenance?assetId=${asset.id}`),
    enabled: open,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['maintenance', asset.id] });
    await qc.invalidateQueries({ queryKey: ['assets'] });
  };

  const add = useMutation({
    mutationFn: () =>
      api.post('/maintenance', {
        assetId: asset.id,
        type: form.type || null,
        scheduledDate: form.scheduledDate,
        cost: Number(form.cost || 0),
        vendor: form.vendor || null,
      }),
    onSuccess: async () => {
      toast.success('Maintenance scheduled');
      await invalidate();
      setForm({ type: '', scheduledDate: toDateInput(new Date()), cost: '', vendor: '' });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const complete = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/maintenance/${id}`, {
        status: 'COMPLETED',
        completedDate: toDateInput(new Date()),
      }),
    onSuccess: async () => {
      toast.success('Marked complete');
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Maintenance — {asset.name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="p-2">Scheduled</th>
                <th className="p-2">Type</th>
                {canSeeFinance && <th className="p-2">Cost</th>}
                <th className="p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {logsQ.isLoading ? (
                <tr>
                  <td
                    colSpan={canSeeFinance ? 5 : 4}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              ) : (logsQ.data?.length ?? 0) === 0 ? (
                <tr>
                  <td
                    colSpan={canSeeFinance ? 5 : 4}
                    className="p-4 text-center text-muted-foreground"
                  >
                    No maintenance logs.
                  </td>
                </tr>
              ) : (
                logsQ.data!.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="p-2">{fmtDate(l.scheduledDate)}</td>
                    <td className="p-2">{l.type ?? '—'}</td>
                    {canSeeFinance && (
                      <td className="p-2">{l.cost != null ? naira(l.cost) : '—'}</td>
                    )}
                    <td className="p-2">
                      {l.isOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        <Badge variant={l.status === 'COMPLETED' ? 'success' : 'secondary'}>
                          {l.status}
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {l.status === 'SCHEDULED' && can('maintenance:update') && (
                        <Button size="sm" variant="outline" onClick={() => complete.mutate(l.id)}>
                          Complete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {can('maintenance:create') && (
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Input
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="e.g. Service"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Scheduled date</Label>
              <Input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cost (₦)</Label>
              <Input
                type="number"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Input
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full">
                {add.isPending && <Loader2 className="size-4 animate-spin" />}
                Schedule maintenance
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
