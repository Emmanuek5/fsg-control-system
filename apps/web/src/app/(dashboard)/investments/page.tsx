'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
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

interface Investment {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  principal: number;
  interestRate: number;
  startDate: string | null;
  maturityDate: string | null;
  expectedReturn: number | null;
  documentUrl: string | null;
  status: string;
  nearingMaturity: boolean;
}

const statusVariant: Record<string, 'success' | 'secondary' | 'warning'> = {
  ACTIVE: 'success',
  MATURED: 'secondary',
  WITHDRAWN: 'warning',
};

const TYPE_LABELS: Record<string, string> = {
  FIXED_DEPOSIT: 'Fixed Deposit',
  BONDS: 'Bonds',
  EQUITY: 'Equity',
  REAL_ESTATE: 'Real Estate',
  OTHER: 'Other',
};

export default function InvestmentsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();

  const itemsQ = useQuery({ queryKey: ['investments'], queryFn: () => api.get<Investment[]>('/investments') });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/investments/${id}`),
    onSuccess: async () => {
      toast.success('Investment deleted');
      await qc.invalidateQueries({ queryKey: ['investments'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Investment>[] = [
    {
      header: 'Investment',
      cell: (i) => (
        <div>
          <div className="font-medium">{i.name}</div>
          <div className="text-xs text-muted-foreground">{i.institution ?? '—'}</div>
        </div>
      ),
    },
    { header: 'Type', cell: (i) => TYPE_LABELS[i.type] ?? i.type },
    { header: 'Principal', cell: (i) => naira(i.principal) },
    { header: 'Rate', cell: (i) => `${i.interestRate}%` },
    {
      header: 'Maturity',
      cell: (i) => (
        <span className="flex items-center gap-2">
          {fmtDate(i.maturityDate)}
          {i.nearingMaturity && <Badge variant="warning">Soon</Badge>}
        </span>
      ),
    },
    { header: 'Status', cell: (i) => <Badge variant={statusVariant[i.status] ?? 'secondary'}>{i.status}</Badge> },
    {
      header: '',
      className: 'text-right',
      cell: (i) => (
        <div className="flex justify-end gap-1">
          {can('investments:update') && (
            <InvestmentDialog
              investment={i}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('investments:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete"
              onClick={() => {
                if (confirm(`Delete "${i.name}"?`)) remove.mutate(i.id);
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
      <PageHeader title="Investments" description="Investment instruments, returns and maturities">
        <ExportButton
          filename="investments"
          rows={itemsQ.data ?? []}
          columns={[
            { header: 'Name', value: (i) => i.name },
            { header: 'Type', value: (i) => i.type },
            { header: 'Institution', value: (i) => i.institution },
            { header: 'Principal', value: (i) => i.principal },
            { header: 'Rate (%)', value: (i) => i.interestRate },
            { header: 'Maturity', value: (i) => i.maturityDate },
            { header: 'Expected return', value: (i) => i.expectedReturn },
            { header: 'Status', value: (i) => i.status },
          ]}
        />
        {can('investments:create') && (
          <InvestmentDialog
            trigger={
              <Button>
                <Plus className="size-4" /> New investment
              </Button>
            }
          />
        )}
      </PageHeader>
      <DataTable columns={columns} rows={itemsQ.data ?? []} loading={itemsQ.isLoading} empty="No investments yet." />
    </div>
  );
}

function InvestmentDialog({ investment, trigger }: { investment?: Investment; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: investment?.name ?? '',
    type: investment?.type ?? 'FIXED_DEPOSIT',
    institution: investment?.institution ?? '',
    principal: String(investment?.principal ?? ''),
    interestRate: String(investment?.interestRate ?? ''),
    startDate: toDateInput(investment?.startDate),
    maturityDate: toDateInput(investment?.maturityDate),
    expectedReturn: String(investment?.expectedReturn ?? ''),
    status: investment?.status ?? 'ACTIVE',
    documentUrl: investment?.documentUrl ?? null,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        type: form.type,
        institution: form.institution || null,
        principal: Number(form.principal || 0),
        interestRate: Number(form.interestRate || 0),
        startDate: form.startDate || null,
        maturityDate: form.maturityDate || null,
        expectedReturn: form.expectedReturn ? Number(form.expectedReturn) : null,
        status: form.status,
        documentUrl: form.documentUrl,
      };
      return investment ? api.patch(`/investments/${investment.id}`, payload) : api.post('/investments', payload);
    },
    onSuccess: async () => {
      toast.success(investment ? 'Investment updated' : 'Investment created');
      await qc.invalidateQueries({ queryKey: ['investments'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{investment ? 'Edit investment' : 'New investment'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="FIXED_DEPOSIT">Fixed Deposit</option>
              <option value="BONDS">Bonds</option>
              <option value="EQUITY">Equity</option>
              <option value="REAL_ESTATE">Real Estate</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Institution</Label>
            <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Principal (₦)</Label>
            <Input
              type="number"
              value={form.principal}
              onChange={(e) => setForm({ ...form, principal: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Interest rate (%)</Label>
            <Input
              type="number"
              value={form.interestRate}
              onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
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
            <Label>Maturity date</Label>
            <Input
              type="date"
              value={form.maturityDate}
              onChange={(e) => setForm({ ...form, maturityDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expected return (₦)</Label>
            <Input
              type="number"
              value={form.expectedReturn}
              onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="MATURED">Matured</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Document</Label>
            <FileUpload
              accept="image/*,application/pdf"
              value={form.documentUrl}
              onChange={(url) => setForm({ ...form, documentUrl: url })}
              label="Upload document"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={form.name.trim().length < 1 || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {investment ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
