'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate, num, toDateInput } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface Subsidiary {
  id: string;
  name: string;
}
interface Batch {
  id: string;
  name: string;
  type: 'LAYERS' | 'BROILERS';
  breed: string | null;
  initialCount: number;
  startDate: string;
  expectedHarvest: string | null;
  status: string;
  notes: string | null;
  subsidiaryId: string | null;
  currentAlive: number;
  mortalityTotal: number;
}

const statusVariant: Record<string, 'success' | 'secondary' | 'warning'> = {
  ACTIVE: 'success',
  HARVESTED: 'secondary',
  CLOSED: 'warning',
};

export function FarmBatchesPage({ type }: { type: 'LAYERS' | 'BROILERS' }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const slug = type === 'LAYERS' ? 'layers' : 'broilers';
  const label = type === 'LAYERS' ? 'Layers' : 'Broilers';

  const batchesQ = useQuery({
    queryKey: ['farm-batches', type],
    queryFn: () => api.get<Batch[]>(`/farm/batches?type=${type}`),
  });
  const subsQ = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: () => api.get<Subsidiary[]>('/subsidiaries'),
    enabled: can('subsidiaries:read'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/farm/batches/${id}`),
    onSuccess: async () => {
      toast.success('Batch deleted');
      await qc.invalidateQueries({ queryKey: ['farm-batches', type] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Batch>[] = [
    {
      header: 'Batch',
      cell: (b) => (
        <Link href={`/farm/${slug}/${b.id}`} className="font-medium text-primary hover:underline">
          {b.name}
        </Link>
      ),
    },
    { header: 'Breed', cell: (b) => b.breed ?? '—' },
    { header: 'Started', cell: (b) => fmtDate(b.startDate) },
    { header: 'Initial', cell: (b) => num(b.initialCount) },
    {
      header: 'Alive',
      cell: (b) => (
        <span className="flex items-center gap-2">
          {num(b.currentAlive)}
          {b.mortalityTotal > 0 && <Badge variant="warning">-{b.mortalityTotal}</Badge>}
        </span>
      ),
    },
    { header: 'Status', cell: (b) => <Badge variant={statusVariant[b.status] ?? 'secondary'}>{b.status}</Badge> },
    {
      header: '',
      className: 'text-right',
      cell: (b) => (
        <div className="flex justify-end gap-1">
          {can('farm:update') && (
            <BatchFormDialog
              type={type}
              batch={b}
              subsidiaries={subsQ.data ?? []}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('farm:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete"
              onClick={() => {
                if (confirm(`Delete batch "${b.name}"?`)) remove.mutate(b.id);
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
      <PageHeader title={label} description={`${label} batches, flock counts and records`}>
        {can('farm:create') && (
          <BatchFormDialog
            type={type}
            subsidiaries={subsQ.data ?? []}
            trigger={
              <Button>
                <Plus className="size-4" /> New batch
              </Button>
            }
          />
        )}
      </PageHeader>
      <DataTable
        columns={columns}
        rows={batchesQ.data ?? []}
        loading={batchesQ.isLoading}
        empty={`No ${label.toLowerCase()} batches yet.`}
      />
    </div>
  );
}

function BatchFormDialog({
  type,
  batch,
  subsidiaries,
  trigger,
}: {
  type: 'LAYERS' | 'BROILERS';
  batch?: Batch;
  subsidiaries: Subsidiary[];
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: batch?.name ?? '',
    breed: batch?.breed ?? '',
    initialCount: String(batch?.initialCount ?? ''),
    startDate: toDateInput(batch?.startDate) || toDateInput(new Date()),
    expectedHarvest: toDateInput(batch?.expectedHarvest),
    status: batch?.status ?? 'ACTIVE',
    subsidiaryId: batch?.subsidiaryId ?? '',
    notes: batch?.notes ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        type,
        breed: form.breed || null,
        initialCount: Number(form.initialCount || 0),
        startDate: form.startDate,
        expectedHarvest: form.expectedHarvest || null,
        status: form.status,
        subsidiaryId: form.subsidiaryId || null,
        notes: form.notes || null,
      };
      return batch ? api.patch(`/farm/batches/${batch.id}`, payload) : api.post('/farm/batches', payload);
    },
    onSuccess: async () => {
      toast.success(batch ? 'Batch updated' : 'Batch created');
      await qc.invalidateQueries({ queryKey: ['farm-batches', type] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{batch ? 'Edit batch' : 'New batch'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Batch name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Breed</Label>
            <Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Initial count</Label>
            <Input
              type="number"
              value={form.initialCount}
              onChange={(e) => setForm({ ...form, initialCount: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
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
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="HARVESTED">Harvested</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </div>
          <div className="space-y-1.5">
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
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={form.name.trim().length < 1 || Number(form.initialCount) < 1 || save.isPending}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {batch ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
