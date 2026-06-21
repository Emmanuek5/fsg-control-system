'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate, naira, num, toDateInput } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface EggRow {
  id: string;
  date: string;
  eggsCollected: number;
  traysCollected: number;
  damaged: number;
}
interface MortalityRow {
  id: string;
  date: string;
  count: number;
  cause: string | null;
}
interface FeedRow {
  id: string;
  date: string;
  feedType: string | null;
  quantityKg: number;
  cost: number;
}
interface BatchDetailData {
  id: string;
  name: string;
  type: 'LAYERS' | 'BROILERS';
  breed: string | null;
  initialCount: number;
  startDate: string;
  status: string;
  currentAlive: number;
  mortalityTotal: number;
  totalEggs: number;
  totalFeedKg: number;
  eggProduction: EggRow[];
  mortalityRecords: MortalityRow[];
  feedRecords: FeedRow[];
}

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

export function BatchDetail({ batchId, type }: { batchId: string; type: 'LAYERS' | 'BROILERS' }) {
  const slug = type === 'LAYERS' ? 'layers' : 'broilers';
  const q = useQuery({
    queryKey: ['farm-batch', batchId],
    queryFn: () => api.get<BatchDetailData>(`/farm/batches/${batchId}`),
  });
  const b = q.data;

  return (
    <div>
      <Link
        href={`/farm/${slug}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to {slug}
      </Link>
      <PageHeader
        title={b?.name ?? 'Batch'}
        description={b ? `${b.breed ?? 'Unknown breed'} · started ${fmtDate(b.startDate)} · ${b.status}` : ''}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Birds alive" value={num(b?.currentAlive ?? 0)} />
        {type === 'LAYERS' && <Stat label="Total eggs" value={num(b?.totalEggs ?? 0)} />}
        <Stat label="Total mortality" value={num(b?.mortalityTotal ?? 0)} />
        <Stat label="Feed used (kg)" value={num(b?.totalFeedKg ?? 0)} />
      </div>

      {type === 'LAYERS' && <EggSection batchId={batchId} rows={b?.eggProduction ?? []} loading={q.isLoading} />}
      <MortalitySection batchId={batchId} rows={b?.mortalityRecords ?? []} loading={q.isLoading} />
      <FeedSection batchId={batchId} rows={b?.feedRecords ?? []} loading={q.isLoading} />
    </div>
  );
}

function useRecordMutation(batchId: string, path: string, label: string, onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post(path, { batchId, ...body }),
    onSuccess: async () => {
      toast.success(`${label} recorded`);
      await qc.invalidateQueries({ queryKey: ['farm-batch', batchId] });
      await qc.invalidateQueries({ queryKey: ['farm-batches'] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function EggSection({ batchId, rows, loading }: { batchId: string; rows: EggRow[]; loading: boolean }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: toDateInput(new Date()), eggsCollected: '', damaged: '' });
  const m = useRecordMutation(batchId, '/farm/eggs', 'Egg collection', () => {
    setOpen(false);
    setForm({ date: toDateInput(new Date()), eggsCollected: '', damaged: '' });
  });

  const columns: Column<EggRow>[] = [
    { header: 'Date', cell: (r) => fmtDate(r.date) },
    { header: 'Eggs', cell: (r) => num(r.eggsCollected) },
    { header: 'Trays', cell: (r) => num(r.traysCollected) },
    { header: 'Damaged', cell: (r) => num(r.damaged) },
  ];

  return (
    <section>
      <SectionHeader
        title="Egg Production"
        action={
          can('farm:create') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" /> Record eggs
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record egg collection</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Eggs collected</Label>
                    <Input
                      type="number"
                      value={form.eggsCollected}
                      onChange={(e) => setForm({ ...form, eggsCollected: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Damaged</Label>
                    <Input
                      type="number"
                      value={form.damaged}
                      onChange={(e) => setForm({ ...form, damaged: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() =>
                      m.mutate({
                        date: form.date,
                        eggsCollected: Number(form.eggsCollected || 0),
                        traysCollected: Math.round(Number(form.eggsCollected || 0) / 30),
                        damaged: Number(form.damaged || 0),
                      })
                    }
                    disabled={m.isPending}
                  >
                    {m.isPending && <Loader2 className="size-4 animate-spin" />}
                    Record
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <DataTable columns={columns} rows={rows} loading={loading} empty="No egg records yet." />
    </section>
  );
}

function MortalitySection({ batchId, rows, loading }: { batchId: string; rows: MortalityRow[]; loading: boolean }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: toDateInput(new Date()), count: '', cause: '' });
  const m = useRecordMutation(batchId, '/farm/mortality', 'Mortality', () => {
    setOpen(false);
    setForm({ date: toDateInput(new Date()), count: '', cause: '' });
  });

  const columns: Column<MortalityRow>[] = [
    { header: 'Date', cell: (r) => fmtDate(r.date) },
    { header: 'Count', cell: (r) => num(r.count) },
    { header: 'Cause', cell: (r) => r.cause ?? '—' },
  ];

  return (
    <section>
      <SectionHeader
        title="Mortality"
        action={
          can('farm:create') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="size-4" /> Record mortality
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record mortality</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Count</Label>
                    <Input
                      type="number"
                      value={form.count}
                      onChange={(e) => setForm({ ...form, count: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cause</Label>
                    <Input value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => m.mutate({ date: form.date, count: Number(form.count || 0), cause: form.cause || null })}
                    disabled={Number(form.count) < 1 || m.isPending}
                  >
                    {m.isPending && <Loader2 className="size-4 animate-spin" />}
                    Record
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <DataTable columns={columns} rows={rows} loading={loading} empty="No mortality records." />
    </section>
  );
}

function FeedSection({ batchId, rows, loading }: { batchId: string; rows: FeedRow[]; loading: boolean }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: toDateInput(new Date()), feedType: '', quantityKg: '', cost: '' });
  const m = useRecordMutation(batchId, '/farm/feed', 'Feed', () => {
    setOpen(false);
    setForm({ date: toDateInput(new Date()), feedType: '', quantityKg: '', cost: '' });
  });

  const columns: Column<FeedRow>[] = [
    { header: 'Date', cell: (r) => fmtDate(r.date) },
    { header: 'Feed type', cell: (r) => r.feedType ?? '—' },
    { header: 'Qty (kg)', cell: (r) => num(r.quantityKg) },
    { header: 'Cost', cell: (r) => naira(r.cost) },
  ];

  return (
    <section>
      <SectionHeader
        title="Feed"
        action={
          can('farm:create') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="size-4" /> Record feed
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record feed</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Feed type</Label>
                    <Input value={form.feedType} onChange={(e) => setForm({ ...form, feedType: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantity (kg)</Label>
                    <Input
                      type="number"
                      value={form.quantityKg}
                      onChange={(e) => setForm({ ...form, quantityKg: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cost (₦)</Label>
                    <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() =>
                      m.mutate({
                        date: form.date,
                        feedType: form.feedType || null,
                        quantityKg: Number(form.quantityKg || 0),
                        cost: Number(form.cost || 0),
                      })
                    }
                    disabled={m.isPending}
                  >
                    {m.isPending && <Loader2 className="size-4 animate-spin" />}
                    Record
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <DataTable columns={columns} rows={rows} loading={loading} empty="No feed records." />
    </section>
  );
}
