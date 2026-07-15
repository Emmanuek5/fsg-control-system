'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useChartColors } from '@/lib/chart-theme';
import { fmtDate, naira, toDateInput } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { ChartCard } from '@/components/chart-card';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import { FileUpload } from '@/components/file-upload';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const CATEGORIES = [
  'Feed',
  'Fuel',
  'Utilities',
  'Salaries',
  'Transport',
  'Maintenance',
  'Supplies',
  'Veterinary',
  'Rent',
  'Other',
];

interface Subsidiary {
  id: string;
  name: string;
}
interface Expense {
  id: string;
  subsidiaryId: string | null;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  incurredAt: string;
  receiptUrl: string | null;
  subsidiary: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
}
interface Summary {
  total: number;
  thisMonth: number;
  byCategory: { category: string; total: number }[];
  byZone: { zone: string; total: number }[];
}

export default function ExpensesPage() {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');
  const qc = useQueryClient();
  const [zoneFilter, setZoneFilter] = useState('');

  const subsQ = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: () => api.get<Subsidiary[]>('/subsidiaries'),
    enabled: can('subsidiaries:read'),
  });
  const expensesQ = useQuery({
    queryKey: ['expenses', zoneFilter],
    queryFn: () =>
      api.get<Expense[]>(`/expenses${zoneFilter ? `?subsidiaryId=${zoneFilter}` : ''}`),
  });
  const summaryQ = useQuery({
    queryKey: ['expense-summary'],
    queryFn: () => api.get<Summary>('/expenses/summary'),
    enabled: canSeeFinance,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/expenses/${id}`),
    onSuccess: async () => {
      toast.success('Expense deleted');
      await qc.invalidateQueries({ queryKey: ['expenses'] });
      await qc.invalidateQueries({ queryKey: ['expense-summary'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Expense>[] = [
    { header: 'Date', cell: (e) => fmtDate(e.incurredAt) },
    { header: 'Zone', cell: (e) => e.subsidiary?.name ?? 'General' },
    { header: 'Category', cell: (e) => <Badge variant="secondary">{e.category}</Badge> },
    { header: 'Description', cell: (e) => e.description ?? '—' },
    { header: 'Vendor', cell: (e) => e.vendor ?? '—' },
    { header: 'Amount', className: 'font-medium', cell: (e) => naira(e.amount) },
    {
      header: '',
      className: 'text-right',
      cell: (e) => (
        <div className="flex justify-end gap-1">
          {can('expenses:update') && (
            <ExpenseDialog
              expense={e}
              subsidiaries={subsQ.data ?? []}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('expenses:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Delete"
              onClick={() => {
                if (confirm('Delete this expense?')) remove.mutate(e.id);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const s = summaryQ.data;
  const chartColors = useChartColors();

  return (
    <div>
      <PageHeader title="Expenses" description="Operational spend across zones and categories">
        <ExportButton
          filename="expenses"
          rows={expensesQ.data ?? []}
          columns={[
            { header: 'Date', value: (e) => e.incurredAt },
            { header: 'Zone', value: (e) => e.subsidiary?.name ?? 'General' },
            { header: 'Category', value: (e) => e.category },
            { header: 'Description', value: (e) => e.description },
            { header: 'Vendor', value: (e) => e.vendor },
            { header: 'Amount', value: (e) => e.amount },
          ]}
        />
        {can('expenses:create') && (
          <ExpenseDialog
            subsidiaries={subsQ.data ?? []}
            trigger={
              <Button>
                <Plus className="size-4" /> New expense
              </Button>
            }
          />
        )}
      </PageHeader>

      {canSeeFinance && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            title="Spent this month"
            value={naira(s?.thisMonth ?? 0)}
            icon={Wallet}
            accent="terracotta"
            loading={summaryQ.isLoading}
          />
          <KpiCard
            title="Total recorded"
            value={naira(s?.total ?? 0)}
            icon={Receipt}
            accent="primary"
            loading={summaryQ.isLoading}
          />
          <KpiCard
            title="Top category"
            value={s?.byCategory[0]?.category ?? '—'}
            hint={s?.byCategory[0] ? naira(s.byCategory[0].total) : undefined}
            icon={Receipt}
            accent="gold"
            loading={summaryQ.isLoading}
          />
        </div>
      )}

      {canSeeFinance && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <ChartCard title="By category">
            <div className="h-64">
              {summaryQ.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s?.byCategory ?? []} margin={{ left: 8, right: 8, top: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartColors.grid}
                    />
                    <XAxis
                      dataKey="category"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      height={48}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip formatter={(v: number) => naira(v)} />
                    <Bar dataKey="total" fill={chartColors.chart3} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>

          <ChartCard title="By zone">
            <div className="h-64">
              {summaryQ.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s?.byZone ?? []} margin={{ left: 8, right: 8, top: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartColors.grid}
                    />
                    <XAxis
                      dataKey="zone"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      height={48}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip formatter={(v: number) => naira(v)} />
                    <Bar dataKey="total" fill={chartColors.chart1} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>
      )}

      <div className="mb-4 max-w-xs">
        <Label className="mb-1.5 block text-xs text-muted-foreground">Filter by zone</Label>
        <Select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
          <option value="">All zones</option>
          {subsQ.data?.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={expensesQ.data ?? []}
        loading={expensesQ.isLoading}
        empty="No expenses recorded yet."
      />
    </div>
  );
}

function ExpenseDialog({
  expense,
  subsidiaries,
  trigger,
}: {
  expense?: Expense;
  subsidiaries: Subsidiary[];
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    subsidiaryId: expense?.subsidiaryId ?? '',
    category: expense?.category ?? '',
    amount: String(expense?.amount ?? ''),
    incurredAt: toDateInput(expense?.incurredAt) || toDateInput(new Date()),
    vendor: expense?.vendor ?? '',
    description: expense?.description ?? '',
    receiptUrl: expense?.receiptUrl ?? null,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        subsidiaryId: form.subsidiaryId || null,
        category: form.category,
        amount: Number(form.amount || 0),
        incurredAt: form.incurredAt,
        vendor: form.vendor || null,
        description: form.description || null,
        receiptUrl: form.receiptUrl,
      };
      return expense
        ? api.patch(`/expenses/${expense.id}`, payload)
        : api.post('/expenses', payload);
    },
    onSuccess: async () => {
      toast.success(expense ? 'Expense updated' : 'Expense recorded');
      await qc.invalidateQueries({ queryKey: ['expenses'] });
      await qc.invalidateQueries({ queryKey: ['expense-summary'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const valid = form.category.trim().length > 0 && Number(form.amount) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit expense' : 'New expense'}</DialogTitle>
        </DialogHeader>
        <datalist id="expense-categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Zone</Label>
            <Select
              value={form.subsidiaryId}
              onChange={(e) => setForm({ ...form, subsidiaryId: e.target.value })}
            >
              <option value="">General (company-wide)</option>
              {subsidiaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input
              list="expense-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Feed, Fuel, Utilities"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₦)</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.incurredAt}
              onChange={(e) => setForm({ ...form, incurredAt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Vendor</Label>
            <Input
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Receipt</Label>
            <FileUpload
              accept="image/*,application/pdf"
              value={form.receiptUrl}
              onChange={(url) => setForm({ ...form, receiptUrl: url })}
              label="Upload receipt"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {expense ? 'Save' : 'Record expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
