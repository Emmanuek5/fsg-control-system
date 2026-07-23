'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CalendarCheck,
  ExternalLink,
  Loader2,
  Plus,
  ReceiptText,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SaleChannel } from '@fsg/shared';
import { api, ApiError, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime, naira, num } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import { FileUpload } from '@/components/file-upload';
import { KpiCard } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface ProductOpt {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantityOnHand: number;
}

interface Sale {
  id: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  channel: SaleChannel;
  customer: string | null;
  soldAt: string;
  verifiedAt: string | null;
  proofUrl: string | null;
  product: { id: string; name: string; unit: string } | null;
  subsidiary: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  verifiedBy: { id: string; name: string } | null;
}

interface SalesSummary {
  todayTotal: number;
  todayCount: number;
  monthTotal: number;
  unverifiedToday: number;
}

interface SalesDaySummary {
  date: string;
  count: number;
  totalAmount: number;
  verifiedCount: number;
  unverifiedCount: number;
  proofUrl: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
}

const channelLabel: Record<SaleChannel, string> = {
  ONLINE: 'Online',
  IN_STORE: 'In store',
  WHOLESALE: 'Wholesale',
};

const channelVariant: Record<SaleChannel, 'default' | 'secondary' | 'outline'> = {
  ONLINE: 'default',
  IN_STORE: 'secondary',
  WHOLESALE: 'outline',
};

function todayInput() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

export default function SalesPage() {
  const { can } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [channel, setChannel] = useState('');
  const [verified, setVerified] = useState('');
  const qc = useQueryClient();

  const salesQ = useQuery({
    queryKey: ['sales', from, to, channel, verified],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (channel) params.set('channel', channel);
      if (verified) params.set('verified', verified);
      const query = params.toString();
      return api.get<Sale[]>(`/sales${query ? `?${query}` : ''}`);
    },
  });
  const summaryQ = useQuery({
    queryKey: ['sales-summary'],
    queryFn: () => api.get<SalesSummary>('/sales/summary'),
  });
  const productsQ = useQuery({
    queryKey: ['products', 'sales'],
    queryFn: () => api.get<ProductOpt[]>('/products'),
    enabled: can('sales:create') && can('products:read'),
  });

  const deleteSale = useMutation({
    mutationFn: (id: string) => api.del(`/sales/${id}`),
    onSuccess: async () => {
      toast.success('Sale deleted and stock restored');
      await qc.invalidateQueries({ queryKey: ['sales'] });
      await qc.invalidateQueries({ queryKey: ['sales-summary'] });
      await qc.invalidateQueries({ queryKey: ['sales-day-summary'] });
      await qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not delete sale'),
  });

  const columns: Column<Sale>[] = [
    { header: 'Date', cell: (sale) => fmtDateTime(sale.soldAt) },
    {
      header: 'Product',
      cell: (sale) => <span className="font-medium">{sale.product?.name ?? '—'}</span>,
    },
    {
      header: 'Qty',
      cell: (sale) => (
        <span>
          {num(sale.quantity)}{' '}
          <span className="text-xs text-muted-foreground">{sale.product?.unit ?? ''}</span>
        </span>
      ),
    },
    { header: 'Unit price', cell: (sale) => naira(sale.unitPrice) },
    {
      header: 'Total',
      cell: (sale) => <span className="font-medium">{naira(sale.totalAmount)}</span>,
    },
    {
      header: 'Channel',
      cell: (sale) => (
        <Badge variant={channelVariant[sale.channel]}>{channelLabel[sale.channel]}</Badge>
      ),
    },
    { header: 'Customer', cell: (sale) => sale.customer ?? '—' },
    { header: 'Recorded by', cell: (sale) => sale.createdBy?.name ?? '—' },
    {
      header: 'Status',
      cell: (sale) =>
        sale.verifiedAt ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="success">Verified</Badge>
            {sale.proofUrl && (
              <a
                href={fileUrl(sale.proofUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Proof <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        ) : (
          <Badge variant="warning">Unverified</Badge>
        ),
    },
    {
      header: '',
      className: 'text-right',
      cell: (sale) =>
        can('sales:delete') && !sale.verifiedAt ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            aria-label="Delete sale"
            disabled={deleteSale.isPending}
            onClick={() => {
              if (confirm('Delete this sale and restore its stock?')) deleteSale.mutate(sale.id);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null,
    },
  ];

  const summary = summaryQ.data;

  return (
    <div>
      <PageHeader title="Sales" description="Recorded sales across subsidiaries">
        <ExportButton
          filename="sales"
          rows={salesQ.data ?? []}
          columns={[
            { header: 'Date', value: (sale) => new Date(sale.soldAt).toISOString() },
            { header: 'Product', value: (sale) => sale.product?.name },
            { header: 'Qty', value: (sale) => sale.quantity },
            { header: 'Unit price', value: (sale) => sale.unitPrice },
            { header: 'Total', value: (sale) => sale.totalAmount },
            { header: 'Channel', value: (sale) => channelLabel[sale.channel] },
            { header: 'Customer', value: (sale) => sale.customer },
            { header: 'Recorded by', value: (sale) => sale.createdBy?.name },
            { header: 'Verified', value: (sale) => (sale.verifiedAt ? 'Yes' : 'No') },
          ]}
        />
        {can('sales:create') && (
          <SaleDialog products={productsQ.data ?? []} productsLoading={productsQ.isLoading} />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Sales today"
          value={naira(summary?.todayTotal)}
          icon={Banknote}
          accent="primary"
          loading={summaryQ.isLoading}
        />
        <KpiCard
          title="Sales this month"
          value={naira(summary?.monthTotal)}
          icon={CalendarCheck}
          accent="gold"
          loading={summaryQ.isLoading}
        />
        <KpiCard
          title="Transactions today"
          value={num(summary?.todayCount)}
          icon={ReceiptText}
          accent="sage"
          loading={summaryQ.isLoading}
        />
        <KpiCard
          title="Unverified today"
          value={num(summary?.unverifiedToday)}
          icon={ShieldAlert}
          accent={(summary?.unverifiedToday ?? 0) > 0 ? 'terracotta' : 'neutral'}
          loading={summaryQ.isLoading}
        />
      </div>

      {can('sales:approve') && <EndOfDayCard />}

      <Card className="mb-4 mt-6">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="sales-from">From</Label>
            <Input
              id="sales-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sales-to">To</Label>
            <Input id="sales-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sales-channel">Channel</Label>
            <Select id="sales-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">All channels</option>
              {Object.values(SaleChannel).map((value) => (
                <option key={value} value={value}>
                  {channelLabel[value]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sales-verified">Status</Label>
            <Select
              id="sales-verified"
              value={verified}
              onChange={(e) => setVerified(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={salesQ.data ?? []}
        loading={salesQ.isLoading}
        empty="No sales match these filters."
      />
    </div>
  );
}

function SaleDialog({
  products,
  productsLoading,
}: {
  products: ProductOpt[];
  productsLoading: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    quantity: '',
    unitPrice: '',
    channel: SaleChannel.ONLINE as SaleChannel,
    customer: '',
    soldAt: '',
  });

  const resetForm = () =>
    setForm({
      productId: '',
      quantity: '',
      unitPrice: '',
      channel: SaleChannel.ONLINE,
      customer: '',
      soldAt: '',
    });

  const save = useMutation({
    mutationFn: () =>
      api.post('/sales', {
        productId: form.productId,
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice),
        channel: form.channel,
        customer: form.customer || null,
        soldAt: form.soldAt || undefined,
      }),
    onSuccess: async () => {
      toast.success('Sale recorded');
      await qc.invalidateQueries({ queryKey: ['sales'] });
      await qc.invalidateQueries({ queryKey: ['sales-summary'] });
      await qc.invalidateQueries({ queryKey: ['sales-day-summary'] });
      await qc.invalidateQueries({ queryKey: ['products'] });
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not record sale'),
  });

  const selectedProduct = products.find((product) => product.id === form.productId);
  const valid =
    form.productId &&
    Number(form.quantity) > 0 &&
    form.unitPrice !== '' &&
    Number(form.unitPrice) >= 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !save.isPending) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Record sale
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record sale</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Product</Label>
            <Select
              value={form.productId}
              onChange={(e) => {
                const product = products.find((item) => item.id === e.target.value);
                setForm({
                  ...form,
                  productId: e.target.value,
                  unitPrice: product ? String(product.unitPrice) : '',
                });
              }}
              disabled={productsLoading}
            >
              <option value="">
                {productsLoading ? 'Loading products…' : 'Select a product…'}
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({num(product.quantityOnHand)} {product.unit} in stock)
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
            {selectedProduct && (
              <p className="text-xs text-muted-foreground">
                {num(selectedProduct.quantityOnHand)} {selectedProduct.unit} available
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Unit price (₦)</Label>
            <Input
              type="number"
              min="0"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value as SaleChannel })}
            >
              {Object.values(SaleChannel).map((value) => (
                <option key={value} value={value}>
                  {channelLabel[value]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Input
              value={form.customer}
              maxLength={120}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.soldAt}
              onChange={(e) => setForm({ ...form, soldAt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Leave blank to use the current date.</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Record sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndOfDayCard() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayInput);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const daySummaryQ = useQuery({
    queryKey: ['sales-day-summary', date],
    queryFn: () => api.get<SalesDaySummary>(`/sales/day-summary?date=${encodeURIComponent(date)}`),
    enabled: Boolean(date),
  });

  const verifyDay = useMutation({
    mutationFn: () => api.post<{ verified: number }>('/sales/verify-day', { date, proofUrl }),
    onSuccess: async (result) => {
      toast.success(
        result.verified === 1 ? '1 sale verified' : `${num(result.verified)} sales verified`,
      );
      await qc.invalidateQueries({ queryKey: ['sales'] });
      await qc.invalidateQueries({ queryKey: ['sales-summary'] });
      await qc.invalidateQueries({ queryKey: ['sales-day-summary'] });
      setProofUrl(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not verify sales'),
  });

  const summary = daySummaryQ.data;
  const allVerified = summary?.unverifiedCount === 0;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">End of day verification</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[180px_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="verification-date">Sales date</Label>
            <Input
              id="verification-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setProofUrl(null);
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                {daySummaryQ.isLoading ? '—' : num(summary?.count)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                {daySummaryQ.isLoading ? '—' : naira(summary?.totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unverified</p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                {daySummaryQ.isLoading ? '—' : num(summary?.unverifiedCount)}
              </p>
            </div>
          </div>

          <Button
            onClick={() => verifyDay.mutate()}
            disabled={daySummaryQ.isLoading || !summary || allVerified || verifyDay.isPending}
          >
            {verifyDay.isPending && <Loader2 className="size-4 animate-spin" />}
            {allVerified ? 'All verified' : 'Verify day'}
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label>Proof document</Label>
            <div className="mt-1.5">
              <FileUpload
                accept="image/*,application/pdf"
                value={proofUrl}
                onChange={setProofUrl}
                label="Upload proof"
              />
            </div>
          </div>

          {summary?.verifiedAt && (
            <div className="text-sm sm:text-right">
              <p>
                Verified by{' '}
                <span className="font-medium">{summary.verifiedByName ?? 'Unknown user'}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDateTime(summary.verifiedAt)}
                {summary.proofUrl && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={fileUrl(summary.proofUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      View proof
                    </a>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
