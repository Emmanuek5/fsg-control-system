'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate, num, toDateInput } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
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
interface Crop {
  id: string;
  name: string;
  variety: string | null;
  plot: string | null;
  areaHectares: number;
  plantingDate: string | null;
  expectedHarvest: string | null;
  expectedYield: number | null;
  actualYield: number | null;
  status: string;
  subsidiaryId: string | null;
}

const statusVariant: Record<string, 'secondary' | 'success' | 'warning' | 'default'> = {
  PLANNED: 'secondary',
  PLANTED: 'default',
  GROWING: 'warning',
  HARVESTED: 'success',
};

export default function CropsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();

  const cropsQ = useQuery({ queryKey: ['crops'], queryFn: () => api.get<Crop[]>('/crops') });
  const subsQ = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: () => api.get<Subsidiary[]>('/subsidiaries'),
    enabled: can('subsidiaries:read'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/crops/${id}`),
    onSuccess: async () => {
      toast.success('Crop deleted');
      await qc.invalidateQueries({ queryKey: ['crops'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Crop>[] = [
    {
      header: 'Crop',
      cell: (c) => (
        <div>
          <div className="font-medium">{c.name}</div>
          <div className="text-xs text-muted-foreground">{c.variety ?? '—'}</div>
        </div>
      ),
    },
    { header: 'Plot', cell: (c) => c.plot ?? '—' },
    { header: 'Area (ha)', cell: (c) => num(c.areaHectares) },
    { header: 'Planted', cell: (c) => fmtDate(c.plantingDate) },
    { header: 'Exp. harvest', cell: (c) => fmtDate(c.expectedHarvest) },
    { header: 'Status', cell: (c) => <Badge variant={statusVariant[c.status] ?? 'secondary'}>{c.status}</Badge> },
    {
      header: '',
      className: 'text-right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          {can('crops:update') && (
            <CropDialog
              crop={c}
              subsidiaries={subsQ.data ?? []}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('crops:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete"
              onClick={() => {
                if (confirm(`Delete "${c.name}"?`)) remove.mutate(c.id);
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
      <PageHeader title="Crops" description="Crop plots, planting and harvest tracking">
        <ExportButton
          filename="crops"
          rows={cropsQ.data ?? []}
          columns={[
            { header: 'Name', value: (c) => c.name },
            { header: 'Variety', value: (c) => c.variety },
            { header: 'Plot', value: (c) => c.plot },
            { header: 'Area (ha)', value: (c) => c.areaHectares },
            { header: 'Planting date', value: (c) => c.plantingDate },
            { header: 'Expected harvest', value: (c) => c.expectedHarvest },
            { header: 'Expected yield', value: (c) => c.expectedYield },
            { header: 'Status', value: (c) => c.status },
          ]}
        />
        {can('crops:create') && (
          <CropDialog
            subsidiaries={subsQ.data ?? []}
            trigger={
              <Button>
                <Plus className="size-4" /> New crop
              </Button>
            }
          />
        )}
      </PageHeader>
      <DataTable columns={columns} rows={cropsQ.data ?? []} loading={cropsQ.isLoading} empty="No crops yet." />
    </div>
  );
}

function CropDialog({
  crop,
  subsidiaries,
  trigger,
}: {
  crop?: Crop;
  subsidiaries: Subsidiary[];
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: crop?.name ?? '',
    variety: crop?.variety ?? '',
    plot: crop?.plot ?? '',
    areaHectares: String(crop?.areaHectares ?? ''),
    plantingDate: toDateInput(crop?.plantingDate),
    expectedHarvest: toDateInput(crop?.expectedHarvest),
    expectedYield: String(crop?.expectedYield ?? ''),
    status: crop?.status ?? 'PLANNED',
    subsidiaryId: crop?.subsidiaryId ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        variety: form.variety || null,
        plot: form.plot || null,
        areaHectares: Number(form.areaHectares || 0),
        plantingDate: form.plantingDate || null,
        expectedHarvest: form.expectedHarvest || null,
        expectedYield: form.expectedYield ? Number(form.expectedYield) : null,
        status: form.status,
        subsidiaryId: form.subsidiaryId || null,
      };
      return crop ? api.patch(`/crops/${crop.id}`, payload) : api.post('/crops', payload);
    },
    onSuccess: async () => {
      toast.success(crop ? 'Crop updated' : 'Crop created');
      await qc.invalidateQueries({ queryKey: ['crops'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{crop ? 'Edit crop' : 'New crop'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Variety</Label>
            <Input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Plot / field</Label>
            <Input value={form.plot} onChange={(e) => setForm({ ...form, plot: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Area (hectares)</Label>
            <Input
              type="number"
              value={form.areaHectares}
              onChange={(e) => setForm({ ...form, areaHectares: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Planting date</Label>
            <Input
              type="date"
              value={form.plantingDate}
              onChange={(e) => setForm({ ...form, plantingDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expected harvest</Label>
            <Input
              type="date"
              value={form.expectedHarvest}
              onChange={(e) => setForm({ ...form, expectedHarvest: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expected yield (tonnes)</Label>
            <Input
              type="number"
              value={form.expectedYield}
              onChange={(e) => setForm({ ...form, expectedYield: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="PLANNED">Planned</option>
              <option value="PLANTED">Planted</option>
              <option value="GROWING">Growing</option>
              <option value="HARVESTED">Harvested</option>
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
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={form.name.trim().length < 1 || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {crop ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
