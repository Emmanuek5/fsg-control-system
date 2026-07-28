'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, MapPin, Pencil, Phone, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime, naira, num } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import { Button } from '@/components/ui/button';
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

interface Customer {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
  subsidiaryId: string | null;
  subsidiary: { id: string; name: string } | null;
  salesCount: number;
  totalSpend: number;
}

interface CustomerDetail extends Customer {
  sales: {
    id: string;
    soldAt: string;
    totalAmount: number;
    logisticsFee: number;
    items: { id: string; productName: string; quantity: number; unit: string }[];
  }[];
}

/** "14 Allen Avenue, Ikeja, Lagos, Nigeria" — skipping the parts that are blank. */
function formatAddress(customer: {
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}) {
  return [customer.addressLine, customer.city, customer.state, customer.country]
    .filter(Boolean)
    .join(', ');
}

export default function CustomersPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const customersQ = useQuery({
    queryKey: ['customers', search],
    queryFn: () =>
      api.get<Customer[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
  const subsQ = useQuery({
    queryKey: ['subsidiaries'],
    queryFn: () => api.get<Subsidiary[]>('/subsidiaries'),
    enabled: can('subsidiaries:read'),
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: string) => api.del(`/customers/${id}`),
    onSuccess: async () => {
      toast.success('Customer deleted');
      await qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const columns: Column<Customer>[] = [
    {
      header: 'Customer',
      cell: (customer) => (
        <div>
          <div className="font-medium">{customer.name}</div>
          <div className="text-xs text-muted-foreground">{customer.company ?? '—'}</div>
        </div>
      ),
    },
    {
      header: 'Contact',
      cell: (customer) => (
        <div className="space-y-0.5 text-sm">
          {customer.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 text-muted-foreground" /> {customer.phone}
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="size-3 text-muted-foreground" /> {customer.email}
            </div>
          )}
          {!customer.phone && !customer.email && <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      header: 'Address',
      cell: (customer) => {
        const address = formatAddress(customer);
        return address ? (
          <span className="flex items-start gap-1.5 text-sm">
            <MapPin className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
            <span className="max-w-[260px]">{address}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    { header: 'Orders', cell: (customer) => num(customer.salesCount) },
    ...(can('sales:read')
      ? [
          {
            header: 'Total spend',
            cell: (customer: Customer) => (
              <span className="font-medium">{naira(customer.totalSpend)}</span>
            ),
          } satisfies Column<Customer>,
        ]
      : []),
    { header: 'Subsidiary', cell: (customer) => customer.subsidiary?.name ?? '—' },
    {
      header: '',
      className: 'text-right',
      cell: (customer) => (
        <div className="flex justify-end gap-1">
          <CustomerDetailDialog
            customer={customer}
            trigger={
              <Button variant="ghost" size="icon" aria-label={`View ${customer.name}`}>
                <Receipt className="size-4" />
              </Button>
            }
          />
          {can('customers:update') && (
            <CustomerDialog
              customer={customer}
              subsidiaries={subsQ.data ?? []}
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Edit ${customer.name}`}>
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {can('customers:delete') && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label={`Delete ${customer.name}`}
              disabled={deleteCustomer.isPending}
              onClick={() => {
                if (confirm(`Delete "${customer.name}"?`)) deleteCustomer.mutate(customer.id);
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
      <PageHeader title="Customers" description="Buyers, contact details and delivery addresses">
        <ExportButton
          filename="customers"
          rows={customersQ.data ?? []}
          columns={[
            { header: 'Name', value: (c) => c.name },
            { header: 'Company', value: (c) => c.company },
            { header: 'Phone', value: (c) => c.phone },
            { header: 'Email', value: (c) => c.email },
            { header: 'Address', value: (c) => c.addressLine },
            { header: 'City', value: (c) => c.city },
            { header: 'State', value: (c) => c.state },
            { header: 'Country', value: (c) => c.country },
            { header: 'Orders', value: (c) => c.salesCount },
            { header: 'Total spend', value: (c) => c.totalSpend },
            { header: 'Subsidiary', value: (c) => c.subsidiary?.name },
          ]}
        />
        {can('customers:create') && (
          <CustomerDialog
            subsidiaries={subsQ.data ?? []}
            trigger={
              <Button>
                <Plus className="size-4" /> New customer
              </Button>
            }
          />
        )}
      </PageHeader>

      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, city…"
          className="pl-8"
        />
      </div>

      <DataTable
        columns={columns}
        rows={customersQ.data ?? []}
        loading={customersQ.isLoading}
        empty="No customers yet. Add your first customer."
      />
    </div>
  );
}

function CustomerDialog({
  customer,
  subsidiaries,
  trigger,
}: {
  customer?: Customer;
  subsidiaries: Subsidiary[];
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    company: customer?.company ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    addressLine: customer?.addressLine ?? '',
    city: customer?.city ?? '',
    state: customer?.state ?? '',
    country: customer?.country ?? 'Nigeria',
    notes: customer?.notes ?? '',
    subsidiaryId: customer?.subsidiaryId ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        addressLine: form.addressLine.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        notes: form.notes.trim() || null,
        subsidiaryId: form.subsidiaryId || null,
      };
      return customer
        ? api.patch(`/customers/${customer.id}`, payload)
        : api.post('/customers', payload);
    },
    onSuccess: async () => {
      toast.success(customer ? 'Customer updated' : 'Customer created');
      await qc.invalidateQueries({ queryKey: ['customers'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit customer' : 'New customer'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              maxLength={160}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input
              value={form.company}
              maxLength={160}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              maxLength={40}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              maxLength={160}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input
              value={form.addressLine}
              maxLength={300}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              placeholder="Street address"
            />
          </div>
          <div className="space-y-1.5">
            <Label>City / town</Label>
            <Input
              value={form.city}
              maxLength={80}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Input
              value={form.state}
              maxLength={80}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Input
              value={form.country}
              maxLength={80}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subsidiary</Label>
            <Select
              value={form.subsidiaryId}
              onChange={(e) => setForm({ ...form, subsidiaryId: e.target.value })}
            >
              <option value="">— None —</option>
              {subsidiaries.map((subsidiary) => (
                <option key={subsidiary.id} value={subsidiary.id}>
                  {subsidiary.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              maxLength={500}
              rows={3}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Delivery instructions, preferences…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {customer ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDetailDialog({
  customer,
  trigger,
}: {
  customer: Customer;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const detailQ = useQuery({
    queryKey: ['customer', customer.id],
    queryFn: () => api.get<CustomerDetail>(`/customers/${customer.id}`),
    enabled: open,
  });

  const address = formatAddress(customer);
  const detail = detailQ.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Company</p>
            <p>{customer.company ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p>{customer.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="break-all">{customer.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total spend</p>
            <p className="font-medium">{naira(customer.totalSpend)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Address</p>
            <p>{address || '—'}</p>
          </div>
          {customer.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p>{customer.notes}</p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Recent orders</p>
          {detailQ.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !detail?.sales.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {detail.sales.map((sale) => (
                <div key={sale.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {fmtDateTime(sale.soldAt)}
                    </span>
                    <span className="font-medium">{naira(sale.totalAmount)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {sale.items
                      .map((item) => `${num(item.quantity)} ${item.unit} × ${item.productName}`)
                      .join(', ')}
                    {sale.logisticsFee > 0 && ` · logistics ${naira(sale.logisticsFee)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
