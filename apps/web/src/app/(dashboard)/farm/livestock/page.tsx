'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { naira, num } from '@/lib/format';
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
interface Animal {
  id: string;
  species: string;
  tagNumber: string | null;
  breed: string | null;
  sex: string | null;
  weightKg: number | null;
  acquisitionCost: number | null;
  status: string;
  subsidiaryId: string | null;
}

const statusVariant: Record<string, 'success' | 'secondary' | 'destructive'> = {
  ALIVE: 'success',
  SOLD: 'secondary',
  DECEASED: 'destructive',
};

export default function LivestockPage() {
  const { can } = useAuth();
  const qc = useQueryClient();

  const animalsQ = useQuery({ queryKey: ['livestock'], queryFn: () => api.get<Animal[]>('/livestock') });
  const subsQ = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: () => api.get<Subsidiary[]>('/subsidiaries'),
    enabled: can('subsidiaries:read'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/livestock/${id}`),
    onSuccess: async () => {
      toast.success('Record deleted');
      await qc.invalidateQueries({ queryKey: ['livestock'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Animal>[] = [
    {
      header: 'Animal',
      cell: (a) => (
        <div>
          <div className="font-medium">{a.species}</div>
          <div className="text-xs text-muted-foreground">{a.tagNumber ?? '—'}</div>
        </div>
      ),
    },
    { header: 'Breed', cell: (a) => a.breed ?? '—' },
    { header: 'Sex', cell: (a) => a.sex ?? '—' },
    { header: 'Weight (kg)', cell: (a) => (a.weightKg != null ? num(a.weightKg) : '—') },
    { header: 'Cost', cell: (a) => (a.acquisitionCost != null ? naira(a.acquisitionCost) : '—') },
    { header: 'Status', cell: (a) => <Badge variant={statusVariant[a.status] ?? 'secondary'}>{a.status}</Badge> },
    {
      header: '',
      className: 'text-right',
      cell: (a) => (
        <div className="flex justify-end gap-1">
          {can('livestock:update') && (
            <AnimalDialog
              animal={a}
              subsidiaries={subsQ.data ?? []}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('livestock:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete"
              onClick={() => {
                if (confirm(`Delete ${a.species} ${a.tagNumber ?? ''}?`)) remove.mutate(a.id);
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
      <PageHeader title="Livestock" description="Individual livestock records and status">
        <ExportButton
          filename="livestock"
          rows={animalsQ.data ?? []}
          columns={[
            { header: 'Species', value: (a) => a.species },
            { header: 'Tag', value: (a) => a.tagNumber },
            { header: 'Breed', value: (a) => a.breed },
            { header: 'Sex', value: (a) => a.sex },
            { header: 'Weight (kg)', value: (a) => a.weightKg },
            { header: 'Acquisition cost', value: (a) => a.acquisitionCost },
            { header: 'Status', value: (a) => a.status },
          ]}
        />
        {can('livestock:create') && (
          <AnimalDialog
            subsidiaries={subsQ.data ?? []}
            trigger={
              <Button>
                <Plus className="size-4" /> New animal
              </Button>
            }
          />
        )}
      </PageHeader>
      <DataTable columns={columns} rows={animalsQ.data ?? []} loading={animalsQ.isLoading} empty="No livestock yet." />
    </div>
  );
}

function AnimalDialog({
  animal,
  subsidiaries,
  trigger,
}: {
  animal?: Animal;
  subsidiaries: Subsidiary[];
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    species: animal?.species ?? '',
    tagNumber: animal?.tagNumber ?? '',
    breed: animal?.breed ?? '',
    sex: animal?.sex ?? '',
    weightKg: String(animal?.weightKg ?? ''),
    acquisitionCost: String(animal?.acquisitionCost ?? ''),
    status: animal?.status ?? 'ALIVE',
    subsidiaryId: animal?.subsidiaryId ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        species: form.species,
        tagNumber: form.tagNumber || null,
        breed: form.breed || null,
        sex: form.sex || null,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
        acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : null,
        status: form.status,
        subsidiaryId: form.subsidiaryId || null,
      };
      return animal ? api.patch(`/livestock/${animal.id}`, payload) : api.post('/livestock', payload);
    },
    onSuccess: async () => {
      toast.success(animal ? 'Animal updated' : 'Animal added');
      await qc.invalidateQueries({ queryKey: ['livestock'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{animal ? 'Edit animal' : 'New animal'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Species</Label>
            <Input value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tag number</Label>
            <Input value={form.tagNumber} onChange={(e) => setForm({ ...form, tagNumber: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Breed</Label>
            <Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Sex</Label>
            <Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Weight (kg)</Label>
            <Input
              type="number"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Acquisition cost (₦)</Label>
            <Input
              type="number"
              value={form.acquisitionCost}
              onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ALIVE">Alive</option>
              <option value="SOLD">Sold</option>
              <option value="DECEASED">Deceased</option>
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
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={form.species.trim().length < 1 || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {animal ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
