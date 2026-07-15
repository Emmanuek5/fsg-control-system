'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate, naira, num, toDateInput } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

type InputType = 'SEED' | 'FERTILIZER' | 'HERBICIDE' | 'PESTICIDE' | 'OTHER';

interface CropInput {
  id: string;
  type: InputType;
  name: string;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  date: string;
  notes: string | null;
}
interface CropRotation {
  id: string;
  season: string;
  cropName: string;
  date: string | null;
  notes: string | null;
}
interface CropDetailData {
  id: string;
  name: string;
  variety: string | null;
  plot: string | null;
  areaHectares: number;
  status: string;
  expectedYield: number | null;
  totalInputCost: number | null;
  inputs: CropInput[];
  rotations: CropRotation[];
}

const inputTypeVariant: Record<
  InputType,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  SEED: 'default',
  FERTILIZER: 'success',
  HERBICIDE: 'warning',
  PESTICIDE: 'destructive',
  OTHER: 'secondary',
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export function CropDetail({ cropId }: { cropId: string }) {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');
  const q = useQuery({
    queryKey: ['crop', cropId],
    queryFn: () => api.get<CropDetailData>(`/crops/${cropId}`),
  });
  const c = q.data;

  return (
    <div>
      <Link
        href="/farm/crops"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to crops
      </Link>
      <PageHeader
        title={c?.name ?? 'Crop'}
        description={
          c ? `${c.variety ?? 'Unknown variety'} Â· ${c.plot ?? 'no plot'} Â· ${c.status}` : ''
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Area (ha)" value={num(c?.areaHectares ?? 0)} />
        {canSeeFinance && (
          <Stat
            label="Input cost"
            value={c?.totalInputCost != null ? naira(c.totalInputCost) : '—'}
          />
        )}
        <Stat
          label="Expected yield"
          value={c?.expectedYield != null ? `${num(c.expectedYield)} t` : '—'}
        />
        <Stat label="Inputs logged" value={num(c?.inputs.length ?? 0)} />
      </div>

      <InputsSection cropId={cropId} rows={c?.inputs ?? []} loading={q.isLoading} />
      <RotationsSection cropId={cropId} rows={c?.rotations ?? []} loading={q.isLoading} />
    </div>
  );
}

function useInvalidate(cropId: string) {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: ['crop', cropId] });
  };
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function InputsSection({
  cropId,
  rows,
  loading,
}: {
  cropId: string;
  rows: CropInput[];
  loading: boolean;
}) {
  const { can } = useAuth();
  const invalidate = useInvalidate(cropId);
  const [open, setOpen] = useState(false);
  const blank = {
    type: 'SEED' as InputType,
    name: '',
    quantity: '',
    unit: '',
    cost: '',
    date: toDateInput(new Date()),
    notes: '',
  };
  const [form, setForm] = useState(blank);

  const add = useMutation({
    mutationFn: () =>
      api.post('/crops/inputs', {
        cropId,
        type: form.type,
        name: form.name,
        quantity: form.quantity ? Number(form.quantity) : null,
        unit: form.unit || null,
        cost: Number(form.cost || 0),
        date: form.date,
        notes: form.notes || null,
      }),
    onSuccess: async () => {
      toast.success('Input recorded');
      await invalidate();
      setOpen(false);
      setForm(blank);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/crops/inputs/${id}`),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<CropInput>[] = [
    { header: 'Date', cell: (r) => fmtDate(r.date) },
    { header: 'Type', cell: (r) => <Badge variant={inputTypeVariant[r.type]}>{r.type}</Badge> },
    { header: 'Item', cell: (r) => r.name },
    {
      header: 'Quantity',
      cell: (r) => (r.quantity != null ? `${num(r.quantity)} ${r.unit ?? ''}` : '—'),
    },
    ...(can('finance:read')
      ? [
          {
            header: 'Cost',
            cell: (r) => (r.cost != null ? naira(r.cost) : '—'),
          } satisfies Column<CropInput>,
        ]
      : []),
    {
      header: '',
      className: 'text-right',
      cell: (r) =>
        can('crops:delete') ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            aria-label="Delete"
            onClick={() => del.mutate(r.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null,
    },
  ];

  return (
    <section>
      <SectionHeader
        title="Inputs (seeds, fertilizer, herbicides)"
        action={
          can('crops:create') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" /> Add input
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add crop input</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as InputType })}
                    >
                      <option value="SEED">Seed</option>
                      <option value="FERTILIZER">Fertilizer</option>
                      <option value="HERBICIDE">Herbicide</option>
                      <option value="PESTICIDE">Pesticide</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Item name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. SAMMAZ 15, Roundup"
                    />
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
                    <Label>Unit</Label>
                    <Input
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      placeholder="kg, L, bag"
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
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => add.mutate()}
                    disabled={form.name.trim().length < 1 || add.isPending}
                  >
                    {add.isPending && <Loader2 className="size-4 animate-spin" />}
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <DataTable columns={columns} rows={rows} loading={loading} empty="No inputs recorded yet." />
    </section>
  );
}

function RotationsSection({
  cropId,
  rows,
  loading,
}: {
  cropId: string;
  rows: CropRotation[];
  loading: boolean;
}) {
  const { can } = useAuth();
  const invalidate = useInvalidate(cropId);
  const [open, setOpen] = useState(false);
  const blank = { season: '', cropName: '', date: '', notes: '' };
  const [form, setForm] = useState(blank);

  const add = useMutation({
    mutationFn: () =>
      api.post('/crops/rotations', {
        cropId,
        season: form.season,
        cropName: form.cropName,
        date: form.date || null,
        notes: form.notes || null,
      }),
    onSuccess: async () => {
      toast.success('Rotation recorded');
      await invalidate();
      setOpen(false);
      setForm(blank);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/crops/rotations/${id}`),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<CropRotation>[] = [
    { header: 'Season', cell: (r) => r.season },
    { header: 'Crop planted', cell: (r) => r.cropName },
    { header: 'Date', cell: (r) => fmtDate(r.date) },
    { header: 'Notes', cell: (r) => r.notes ?? '—' },
    {
      header: '',
      className: 'text-right',
      cell: (r) =>
        can('crops:delete') ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            aria-label="Delete"
            onClick={() => del.mutate(r.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null,
    },
  ];

  return (
    <section>
      <SectionHeader
        title="Rotations"
        action={
          can('crops:create') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="size-4" /> Add rotation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add rotation</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Season</Label>
                    <Input
                      value={form.season}
                      onChange={(e) => setForm({ ...form, season: e.target.value })}
                      placeholder="e.g. 2026 Wet"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Crop planted</Label>
                    <Input
                      value={form.cropName}
                      onChange={(e) => setForm({ ...form, cropName: e.target.value })}
                      placeholder="e.g. Soybean"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => add.mutate()}
                    disabled={
                      form.season.trim().length < 1 ||
                      form.cropName.trim().length < 1 ||
                      add.isPending
                    }
                  >
                    {add.isPending && <Loader2 className="size-4 animate-spin" />}
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        empty="No rotations recorded yet."
      />
    </section>
  );
}
