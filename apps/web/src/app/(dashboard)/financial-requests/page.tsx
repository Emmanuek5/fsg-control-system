'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalStatus as ApprovalStatusValues, FinancialRequestType as FinancialRequestTypeValues, StaffDepartment as StaffDepartmentValues } from '@fsg/shared';
type ApprovalStatus = (typeof ApprovalStatusValues)[keyof typeof ApprovalStatusValues];
type FinancialRequestType = (typeof FinancialRequestTypeValues)[keyof typeof FinancialRequestTypeValues];
type StaffDepartment = (typeof StaffDepartmentValues)[keyof typeof StaffDepartmentValues];
const FinancialRequestType = FinancialRequestTypeValues;
const StaffDepartment = StaffDepartmentValues;
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime, naira } from '@/lib/format';
import { departmentLabel, financialTypeLabel, statusLabel, statusVariant } from '@/lib/approval';
import { detectNetwork, lookupElectricity, useDataProducts, useDiscos, usePaymentsStatus, FALLBACK_DISCOS, type Network } from '@/lib/payments';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FileUpload } from '@/components/file-upload';
import { BankAccountFields } from '@/components/payments/bank-account-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Subsidiary { id: string; name: string; }
interface FinancialRequest {
  id: string; type: FinancialRequestType; amount: number; category: string; status: ApprovalStatus; createdAt: string;
  vendor: string | null; payeeName: string | null; phoneNumber: string | null; network: string | null; disco: string | null;
  subsidiary: { id: string; name: string } | null; requestedBy: { id: string; name: string; email: string } | null;
}

export default function FinancialRequestsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const requestsQ = useQuery({ queryKey: ['financial-requests', status], queryFn: () => api.get<FinancialRequest[]>(`/financial-requests${status ? `?status=${status}` : ''}`) });
  const subsQ = useQuery({ queryKey: ['subsidiaries'], queryFn: () => api.get<Subsidiary[]>('/subsidiaries'), enabled: can('subsidiaries:read') });
  const columns: Column<FinancialRequest>[] = [
    { header: 'Date', cell: (r) => fmtDateTime(r.createdAt) },
    { header: 'Type', cell: (r) => financialTypeLabel[r.type] },
    { header: 'Category', cell: (r) => r.category },
    { header: 'Amount', cell: (r) => naira(r.amount), className: 'font-medium' },
    { header: 'Recipient', cell: (r) => r.payeeName ?? r.vendor ?? r.phoneNumber ?? r.disco ?? '-' },
    { header: 'Requester', cell: (r) => r.requestedBy?.name ?? '-' },
    { header: 'Status', cell: (r) => <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge> },
    { header: '', className: 'text-right', cell: (r) => <Button variant="ghost" size="icon" asChild aria-label="Open request"><Link href={`/financial-requests/${r.id}`}><Eye className="size-4" /></Link></Button> },
  ];
  return <div><PageHeader title="Financial Requests" description="Request expenses and payouts for approval before payment"><FinancialRequestDialog subsidiaries={subsQ.data ?? []} /></PageHeader><div className="mb-4 max-w-xs"><Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All requests</option><option value="PENDING">Pending</option><option value="NEEDS_INFO">Needs info</option><option value="APPROVED">Approved</option><option value="DENIED">Denied</option></Select></div><DataTable columns={columns} rows={requestsQ.data ?? []} loading={requestsQ.isLoading} empty="No financial requests yet." /></div>;
}

const NETWORKS: Network[] = ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];
const BILL_TYPES = new Set<FinancialRequestType>(['AIRTIME', 'DATA_BUNDLE', 'ELECTRICITY_BILL']);

function FinancialRequestDialog({ subsidiaries }: { subsidiaries: Subsidiary[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: FinancialRequestType.CASH_EXPENSE as FinancialRequestType,
    subsidiaryId: '', department: '' as StaffDepartment | '', amount: '', category: '', description: '',
    vendor: '', payeeName: '', requestedFor: '', attachmentUrl: null as string | null,
    phoneNumber: '', network: '', dataPlan: '', disco: '', customerId: '', meterType: 'PREPAID', payerName: '',
    bankCode: '', bankName: '', bankAccountNumber: '',
  });
  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  // Bills vending is feature-gated until Monnify activates it on the account.
  // Until then staff request a bank transfer / cash expense and buy bills themselves.
  const statusQ = usePaymentsStatus();
  const billsEnabled = statusQ.data?.billsEnabled ?? false;
  const typeOptions = Object.values(FinancialRequestType).filter((t) => billsEnabled || !BILL_TYPES.has(t));

  const needsPhone = form.type === 'AIRTIME' || form.type === 'DATA_BUNDLE';
  const isData = form.type === 'DATA_BUNDLE';
  const isElectricity = form.type === 'ELECTRICITY_BILL';
  const isBankTransfer = form.type === 'BANK_TRANSFER';
  const isCashExpense = form.type === 'CASH_EXPENSE';

  // Auto-detect the telco from the phone number until the user overrides it.
  const networkTouched = useRef(false);
  useEffect(() => {
    if (!needsPhone || networkTouched.current) return;
    const detected = detectNetwork(form.phoneNumber);
    if (detected && detected !== form.network) patch({ network: detected });
  }, [form.phoneNumber, needsPhone]);

  const plansQ = useDataProducts(isData ? form.network : null);
  const discosQ = useDiscos(isElectricity);

  // Resolve the electricity customer name from the disco + meter/customer number.
  const [elecState, setElecState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  useEffect(() => {
    if (!isElectricity || !form.disco || form.customerId.trim().length < 4) {
      setElecState('idle');
      return;
    }
    let cancelled = false;
    setElecState('loading');
    const timer = setTimeout(async () => {
      try {
        const res = await lookupElectricity(form.disco, form.customerId.trim(), form.meterType);
        if (cancelled) return;
        if (res.customerName) {
          patch({ payerName: res.customerName });
          setElecState('ok');
        } else setElecState('error');
      } catch {
        if (!cancelled) setElecState('error');
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isElectricity, form.disco, form.customerId]);

  const save = useMutation({
    mutationFn: () => api.post('/financial-requests', {
      ...form,
      subsidiaryId: form.subsidiaryId || null,
      department: form.department || null,
      amount: Number(form.amount || 0),
      vendor: form.vendor || null,
      payeeName: form.payeeName || null,
      requestedFor: form.requestedFor || null,
      attachmentUrl: form.attachmentUrl,
      description: form.description || null,
      phoneNumber: form.phoneNumber || null,
      network: form.network || null,
      dataPlan: form.dataPlan || null,
      disco: form.disco || null,
      customerId: form.customerId || null,
      meterType: form.meterType || null,
      payerName: form.payerName || null,
      bankCode: form.bankCode || null,
      bankName: form.bankName || null,
      bankAccountNumber: form.bankAccountNumber || null,
    }),
    onSuccess: async () => { toast.success('Financial request submitted'); await qc.invalidateQueries({ queryKey: ['financial-requests'] }); await qc.invalidateQueries({ queryKey: ['notifications-unread-count'] }); setOpen(false); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not submit request'),
  });

  const valid = Number(form.amount) > 0 && form.category.trim()
    && (!needsPhone || (form.phoneNumber && form.network))
    && (!isData || form.dataPlan)
    && (!isElectricity || (form.disco && form.customerId && form.meterType && form.payerName));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" /> New request</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New financial request</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Type</Label><Select value={form.type} onChange={(e) => patch({ type: e.target.value as FinancialRequestType })}>{typeOptions.map((t) => <option key={t} value={t}>{financialTypeLabel[t]}</option>)}</Select>{!billsEnabled && <p className="text-xs text-muted-foreground">For airtime, data or electricity, request a bank transfer to your account and purchase it yourself.</p>}</div>
          <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => patch({ amount: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => patch({ category: e.target.value })} placeholder="Fuel, Airtime, PHCN" /></div>
          <div className="space-y-1.5"><Label>Zone</Label><Select value={form.subsidiaryId} onChange={(e) => patch({ subsidiaryId: e.target.value })}><option value="">General</option>{subsidiaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Department</Label><Select value={form.department} onChange={(e) => patch({ department: e.target.value as StaffDepartment })}><option value="">None</option>{Object.keys(departmentLabel).map((d) => <option key={d} value={d}>{departmentLabel[d as StaffDepartment]}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Needed by</Label><Input type="date" value={form.requestedFor} onChange={(e) => patch({ requestedFor: e.target.value })} /></div>

          {needsPhone && (
            <>
              <div className="space-y-1.5"><Label>Phone number</Label><Input value={form.phoneNumber} onChange={(e) => patch({ phoneNumber: e.target.value })} placeholder="0803..." /></div>
              <div className="space-y-1.5"><Label>Network</Label><Select value={form.network} onChange={(e) => { networkTouched.current = true; patch({ network: e.target.value }); }}><option value="">Select</option>{NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
              {isData && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="flex items-center gap-1.5">Data plan{plansQ.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}</Label>
                  {plansQ.data && plansQ.data.length > 0 ? (
                    <Select value={form.dataPlan} onChange={(e) => { const p = plansQ.data!.find((pl) => pl.plan === e.target.value); patch({ dataPlan: e.target.value, amount: p ? String(p.amount) : form.amount }); }}>
                      <option value="">{form.network ? 'Select a plan' : 'Choose a network first'}</option>
                      {plansQ.data.map((p) => <option key={p.plan} value={p.plan}>{p.plan}</option>)}
                    </Select>
                  ) : (
                    <Input value={form.dataPlan} onChange={(e) => patch({ dataPlan: e.target.value })} placeholder="e.g. 10GB / 30 days" />
                  )}
                </div>
              )}
            </>
          )}

          {isElectricity && (
            <>
              <div className="space-y-1.5">
                <Label>Disco</Label>
                <Select value={form.disco} onChange={(e) => patch({ disco: e.target.value })}>
                  <option value="">Select provider</option>
                  {(discosQ.data && discosQ.data.length > 0 ? discosQ.data : FALLBACK_DISCOS).map((d) => <option key={d.code ?? d.id} value={d.code ?? d.id}>{d.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Meter/customer no.</Label><Input value={form.customerId} onChange={(e) => patch({ customerId: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Meter type</Label><Select value={form.meterType} onChange={(e) => patch({ meterType: e.target.value })}><option value="PREPAID">Prepaid</option><option value="POSTPAID">Postpaid</option></Select></div>
              <div className="space-y-1.5"><Label className="flex items-center gap-1.5">Payer name{elecState === 'loading' && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}{elecState === 'ok' && <Check className="size-3.5 text-success" />}{elecState === 'error' && <TriangleAlert className="size-3.5 text-warning" />}</Label><Input value={form.payerName} onChange={(e) => patch({ payerName: e.target.value })} className={elecState === 'ok' ? 'border-success/60' : undefined} /></div>
            </>
          )}

          {isBankTransfer && (
            <BankAccountFields
              value={{ bankCode: form.bankCode, bankName: form.bankName, accountNumber: form.bankAccountNumber, accountName: form.payeeName }}
              onChange={(v) => patch({ bankCode: v.bankCode, bankName: v.bankName, bankAccountNumber: v.accountNumber, payeeName: v.accountName })}
              accountNameLabel="Account name (payee)"
            />
          )}

          {isCashExpense && (
            <>
              <div className="space-y-1.5"><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => patch({ vendor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Payee</Label><Input value={form.payeeName} onChange={(e) => patch({ payeeName: e.target.value })} /></div>
            </>
          )}

          <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Attachment</Label><FileUpload accept="image/*,application/pdf" value={form.attachmentUrl} onChange={(url) => patch({ attachmentUrl: url })} label="Upload support" /></div>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />}Submit request</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



