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
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { SaleChannel, type SalesBySubsidiaryPoint } from '@fsg/shared';
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
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { buildSellables, type ProductWithVariants } from '@/lib/sellables';
import { SectionPerformance } from './section-performance';

type ProductOpt = ProductWithVariants;

interface SubsidiaryOpt {
  id: string;
  name: string;
  type: string;
}

interface CustomerOpt {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
}

interface SaleItem {
  id: string;
  productId: string | null;
  productName: string;
  /** Null on lines recorded before variants existed. */
  variantName: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * A sale line's product, qualified by variant. "Default" is the placeholder
 * every single-variant product carries, so it adds nothing worth showing.
 */
const itemLabel = (item: SaleItem) =>
  item.variantName && item.variantName !== 'Default'
    ? `${item.productName} (${item.variantName})`
    : item.productName;

interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  logisticsFee: number;
  totalAmount: number;
  channel: SaleChannel;
  customerId: string | null;
  customerName: string | null;
  customer: { id: string; name: string; phone: string | null; city: string | null } | null;
  note: string | null;
  soldAt: string;
  verifiedAt: string | null;
  proofUrl: string | null;
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
  logisticsTotal: number;
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

function buyerName(sale: Sale) {
  return sale.customer?.name ?? sale.customerName ?? null;
}

function itemsSummary(sale: Sale) {
  return sale.items
    .map((item) => `${num(item.quantity)} ${item.unit} × ${itemLabel(item)}`)
    .join('; ');
}

export default function SalesPage() {
  const { can } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [channel, setChannel] = useState('');
  const [verified, setVerified] = useState('');
  const [subsidiaryId, setSubsidiaryId] = useState('');
  const qc = useQueryClient();

  const salesQ = useQuery({
    queryKey: ['sales', from, to, channel, verified, subsidiaryId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (channel) params.set('channel', channel);
      if (verified) params.set('verified', verified);
      if (subsidiaryId) params.set('subsidiaryId', subsidiaryId);
      const query = params.toString();
      return api.get<Sale[]>(`/sales${query ? `?${query}` : ''}`);
    },
  });
  const summaryQ = useQuery({
    // Follows the section filter so the cards describe the same sales the
    // table below is showing.
    queryKey: ['sales-summary', subsidiaryId],
    queryFn: () =>
      api.get<SalesSummary>(
        `/sales/summary${subsidiaryId ? `?subsidiaryId=${subsidiaryId}` : ''}`,
      ),
  });
  // The breakdown spans every section regardless of the section filter — it is
  // the comparison, so narrowing it to one row would defeat the point.
  const breakdownQ = useQuery({
    queryKey: ['sales-by-subsidiary', from, to, channel, verified],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (channel) params.set('channel', channel);
      if (verified) params.set('verified', verified);
      const query = params.toString();
      return api.get<SalesBySubsidiaryPoint[]>(`/sales/by-subsidiary${query ? `?${query}` : ''}`);
    },
  });
  const subsidiariesQ = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: () => api.get<SubsidiaryOpt[]>('/subsidiaries'),
    enabled: can('subsidiaries:read'),
  });
  const productsQ = useQuery({
    queryKey: ['products', 'sales'],
    queryFn: () => api.get<ProductOpt[]>('/products'),
    enabled: can('sales:create') && can('products:read'),
  });
  const customersQ = useQuery({
    queryKey: ['customers', 'sales'],
    queryFn: () => api.get<CustomerOpt[]>('/customers'),
    enabled: can('sales:create') && can('customers:read'),
  });

  const deleteSale = useMutation({
    mutationFn: (id: string) => api.del(`/sales/${id}`),
    onSuccess: async () => {
      toast.success('Sale deleted and stock restored');
      await qc.invalidateQueries({ queryKey: ['sales'] });
      await qc.invalidateQueries({ queryKey: ['sales-summary'] });
      await qc.invalidateQueries({ queryKey: ['sales-by-subsidiary'] });
      await qc.invalidateQueries({ queryKey: ['sales-day-summary'] });
      await qc.invalidateQueries({ queryKey: ['products'] });
      await qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not delete sale'),
  });

  const columns: Column<Sale>[] = [
    { header: 'Date', cell: (sale) => fmtDateTime(sale.soldAt) },
    {
      header: 'Items',
      cell: (sale) => (
        <div className="space-y-0.5">
          {sale.items.map((item) => (
            <div key={item.id} className="whitespace-nowrap">
              <span className="font-medium">{itemLabel(item)}</span>{' '}
              <span className="text-xs text-muted-foreground">
                {num(item.quantity)} {item.unit} × {naira(item.unitPrice)}
              </span>
            </div>
          ))}
          {sale.items.length === 0 && <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      header: 'Customer',
      cell: (sale) => {
        const name = buyerName(sale);
        if (!name) return <span className="text-muted-foreground">—</span>;
        const detail = sale.customer?.phone ?? sale.customer?.city;
        return (
          <div>
            <div>{name}</div>
            {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
          </div>
        );
      },
    },
    { header: 'Subtotal', cell: (sale) => naira(sale.subtotal) },
    {
      header: 'Logistics',
      cell: (sale) =>
        sale.logisticsFee > 0 ? (
          naira(sale.logisticsFee)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: 'Total',
      cell: (sale) => <span className="font-medium">{naira(sale.totalAmount)}</span>,
    },
    {
      header: 'Section',
      cell: (sale) =>
        sale.subsidiary ? (
          sale.subsidiary.name
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: 'Channel',
      cell: (sale) => (
        <Badge variant={channelVariant[sale.channel]}>{channelLabel[sale.channel]}</Badge>
      ),
    },
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
            { header: 'Items', value: (sale) => itemsSummary(sale) },
            { header: 'Customer', value: (sale) => buyerName(sale) },
            { header: 'Subtotal', value: (sale) => sale.subtotal },
            { header: 'Logistics fee', value: (sale) => sale.logisticsFee },
            { header: 'Total', value: (sale) => sale.totalAmount },
            { header: 'Section', value: (sale) => sale.subsidiary?.name },
            { header: 'Channel', value: (sale) => channelLabel[sale.channel] },
            { header: 'Recorded by', value: (sale) => sale.createdBy?.name },
            { header: 'Verified', value: (sale) => (sale.verifiedAt ? 'Yes' : 'No') },
          ]}
        />
        {can('sales:create') && (
          <SaleDialog
            products={productsQ.data ?? []}
            productsLoading={productsQ.isLoading}
            customers={customersQ.data ?? []}
            subsidiaries={subsidiariesQ.data ?? []}
          />
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

      <SectionPerformance
        rows={breakdownQ.data ?? []}
        loading={breakdownQ.isLoading}
        periodLabel={
          from || to
            ? `${from || 'start'} → ${to || 'today'}`
            : 'All time'
        }
      />

      <Card className="mb-4 mt-6">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <Label htmlFor="sales-section">Section</Label>
            <Select
              id="sales-section"
              value={subsidiaryId}
              onChange={(e) => setSubsidiaryId(e.target.value)}
              disabled={subsidiariesQ.isLoading}
            >
              <option value="">All sections</option>
              {(subsidiariesQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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

interface LineForm {
  /** `${productId}:${variantId}` — the key of the chosen sellable. */
  sellableKey: string;
  quantity: string;
  unitPrice: string;
}

const emptyLine: LineForm = { sellableKey: '', quantity: '1', unitPrice: '' };

function SaleDialog({
  products,
  productsLoading,
  customers,
  subsidiaries,
}: {
  products: ProductOpt[];
  productsLoading: boolean;
  customers: CustomerOpt[];
  subsidiaries: SubsidiaryOpt[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }]);
  // Staff attached to one section record its sales far more often than any
  // other, so start them there; head-office users start blank and choose.
  const defaultSubsidiary = user?.subsidiaryId ?? '';
  const [form, setForm] = useState({
    customerId: '',
    customerName: '',
    logisticsFee: '',
    channel: SaleChannel.ONLINE as SaleChannel,
    note: '',
    soldAt: '',
    subsidiaryId: defaultSubsidiary,
  });

  const resetForm = () => {
    setLines([{ ...emptyLine }]);
    setForm({
      customerId: '',
      customerName: '',
      logisticsFee: '',
      channel: SaleChannel.ONLINE,
      note: '',
      soldAt: '',
      subsidiaryId: defaultSubsidiary,
    });
  };

  const sellables = buildSellables(products);
  const sellableByKey = new Map(sellables.map((option) => [option.key, option]));
  const priced = lines.map((line) => {
    const option = sellableByKey.get(line.sellableKey);
    const quantity = Number(line.quantity || 0);
    const unitPrice = line.unitPrice === '' ? (option?.unitPrice ?? 0) : Number(line.unitPrice);
    return { line, option, quantity, unitPrice, lineTotal: quantity * unitPrice };
  });
  const subtotal = priced.reduce((sum, row) => sum + (row.option ? row.lineTotal : 0), 0);
  const logisticsFee = Number(form.logisticsFee || 0);
  const total = subtotal + logisticsFee;

  const overStock = priced.some((row) => row.option && row.quantity > row.option.available);
  const valid =
    priced.length > 0 &&
    priced.every((row) => row.option && row.quantity > 0 && row.unitPrice >= 0) &&
    !overStock &&
    logisticsFee >= 0;

  const updateLine = (index: number, patch: Partial<LineForm>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const save = useMutation({
    mutationFn: () =>
      api.post('/sales', {
        items: priced.map((row) => ({
          productId: row.option!.productId,
          variantId: row.option!.variantId,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
        })),
        logisticsFee,
        channel: form.channel,
        customerId: form.customerId || null,
        customerName: form.customerId ? null : form.customerName.trim() || null,
        note: form.note.trim() || null,
        soldAt: form.soldAt || undefined,
        subsidiaryId: form.subsidiaryId || null,
      }),
    onSuccess: async () => {
      toast.success('Sale recorded');
      await qc.invalidateQueries({ queryKey: ['sales'] });
      await qc.invalidateQueries({ queryKey: ['sales-summary'] });
      await qc.invalidateQueries({ queryKey: ['sales-by-subsidiary'] });
      await qc.invalidateQueries({ queryKey: ['sales-day-summary'] });
      await qc.invalidateQueries({ queryKey: ['products'] });
      await qc.invalidateQueries({ queryKey: ['customers'] });
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not record sale'),
  });

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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Record sale</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              <option value="">Walk-in / not listed</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.city ? ` — ${customer.city}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Buyer name</Label>
            <Input
              value={form.customerName}
              maxLength={120}
              disabled={Boolean(form.customerId)}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder={form.customerId ? 'Using selected customer' : 'Optional'}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Products</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines([...lines, { ...emptyLine }])}
            >
              <Plus className="size-4" /> Add product
            </Button>
          </div>

          <div className="space-y-2">
            {priced.map((row, index) => {
              // Each product *variant* may only appear once per sale — two
              // sizes of the same rice on one order are perfectly normal.
              const taken = new Set(
                lines.filter((_, i) => i !== index).map((line) => line.sellableKey),
              );
              return (
                <div
                  key={index}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_90px_120px_auto] sm:items-start"
                >
                  <div className="space-y-1">
                    <Combobox
                      value={row.line.sellableKey}
                      onChange={(key) => {
                        const option = sellableByKey.get(key);
                        updateLine(index, {
                          sellableKey: key,
                          unitPrice: option ? String(option.unitPrice) : '',
                        });
                      }}
                      disabled={productsLoading}
                      aria-label={`Product ${index + 1}`}
                      placeholder={productsLoading ? 'Loading products…' : 'Select a product…'}
                      options={sellables
                        .filter((option) => !taken.has(option.key))
                        .map((option) => ({
                          value: option.key,
                          label: option.label,
                          hint: `${num(option.available)} available`,
                        }))}
                    />
                    {row.option && (
                      <p
                        className={
                          row.quantity > row.option.available
                            ? 'text-xs text-destructive'
                            : 'text-xs text-muted-foreground'
                        }
                      >
                        {num(row.option.available)} available
                        {row.quantity > row.option.available && ' — not enough stock'}
                      </p>
                    )}
                  </div>

                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={row.line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    aria-label={`Quantity ${index + 1}`}
                    placeholder="Qty"
                  />
                  <Input
                    type="number"
                    min="0"
                    value={row.line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                    aria-label={`Unit price ${index + 1}`}
                    placeholder="Unit price"
                  />

                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                    <span className="text-sm font-medium tabular-nums">
                      {naira(row.option ? row.lineTotal : 0)}
                    </span>
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove product ${index + 1}`}
                        onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Logistics / delivery fee (₦)</Label>
            <Input
              type="number"
              min="0"
              value={form.logisticsFee}
              onChange={(e) => setForm({ ...form, logisticsFee: e.target.value })}
              placeholder="0"
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
            <Label>Section</Label>
            <Select
              value={form.subsidiaryId}
              onChange={(e) => setForm({ ...form, subsidiaryId: e.target.value })}
            >
              <option value="">Work it out from the products</option>
              {subsidiaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Which part of the business earned this sale. Left blank, it falls back to the
              customer&rsquo;s section and then the product&rsquo;s.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.soldAt}
              onChange={(e) => setForm({ ...form, soldAt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Leave blank to use the current date.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input
              value={form.note}
              maxLength={300}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{naira(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Logistics</span>
            <span className="tabular-nums">{naira(logisticsFee)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-display text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{naira(total)}</span>
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

          <div className="grid grid-cols-4 gap-3 rounded-lg border bg-muted/30 p-3">
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
              <p className="text-xs text-muted-foreground">Logistics</p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                {daySummaryQ.isLoading ? '—' : naira(summary?.logisticsTotal)}
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
