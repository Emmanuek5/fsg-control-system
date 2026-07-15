'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CreditCard, Loader2, MessageSquare, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalStatus as ApprovalStatusValues, FinancialRequestType as FinancialRequestTypeValues, StaffDepartment as StaffDepartmentValues } from '@fsg/shared';
type ApprovalStatus = (typeof ApprovalStatusValues)[keyof typeof ApprovalStatusValues];
type FinancialRequestType = (typeof FinancialRequestTypeValues)[keyof typeof FinancialRequestTypeValues];
type StaffDepartment = (typeof StaffDepartmentValues)[keyof typeof StaffDepartmentValues];
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime, naira } from '@/lib/format';
import { departmentLabel, financialTypeLabel, statusLabel, statusVariant } from '@/lib/approval';
import { usePaymentsStatus } from '@/lib/payments';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Comment { id: string; message: string; isInstruction: boolean; createdAt: string; author: { id: string; name: string } | null; }
interface FinancialRequest {
  id: string; type: FinancialRequestType; amount: number; category: string; description: string | null; vendor: string | null; payeeName: string | null; department: StaffDepartment | null; status: ApprovalStatus; decisionNote: string | null; createdAt: string; decidedAt: string | null; phoneNumber: string | null; network: string | null; dataPlan: string | null; disco: string | null; customerId: string | null; meterType: string | null; payerName: string | null; merchantTxRef: string | null; provider: string; providerStatus: string; providerReference: string | null; subsidiary: { id: string; name: string } | null; requestedBy: { id: string; name: string; email: string } | null; approvedBy: { id: string; name: string; email: string } | null; expense: { id: string; paymentStatus: string } | null; comments: Comment[];
}

const payableTypes = new Set(['BANK_TRANSFER', 'AIRTIME', 'DATA_BUNDLE', 'ELECTRICITY_BILL']);
const billTypes = new Set(['AIRTIME', 'DATA_BUNDLE', 'ELECTRICITY_BILL']);
const providerStatusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  SUCCESS: 'success',
  FAILED: 'destructive',
  PROCESSING: 'warning',
  NOT_INITIATED: 'secondary',
};

export default function FinancialRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [otpOpen, setOtpOpen] = useState(false);

  const statusQ = usePaymentsStatus();
  const billsEnabled = statusQ.data?.billsEnabled ?? false;
  const requestQ = useQuery({ queryKey: ['financial-request', params.id], queryFn: () => api.get<FinancialRequest>(`/financial-requests/${params.id}`) });
  const request = requestQ.data;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['financial-request', params.id] });
    await qc.invalidateQueries({ queryKey: ['financial-requests'] });
    await qc.invalidateQueries({ queryKey: ['expenses'] });
    await qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  };

  const decide = useMutation({ mutationFn: ({ action, note }: { action: 'approve' | 'deny' | 'request-info'; note: string }) => api.post(`/financial-requests/${params.id}/${action}`, { note: note || null }), onSuccess: async () => { toast.success('Decision saved'); await invalidate(); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Decision failed') });
  const addComment = useMutation({ mutationFn: (message: string) => api.post(`/financial-requests/${params.id}/comments`, { message, isInstruction: false }), onSuccess: async () => { toast.success('Comment added'); await qc.invalidateQueries({ queryKey: ['financial-request', params.id] }); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Comment failed') });
  const pay = useMutation({ mutationFn: () => api.post<{ requiresOtp?: boolean }>(`/financial-requests/${params.id}/pay`, {}), onSuccess: async (res) => { if (res.requiresOtp) setOtpOpen(true); else toast.success('Payment submitted'); await invalidate(); }, onError: async (e) => { toast.error(e instanceof ApiError ? e.message : 'Payment failed'); await invalidate(); } });
  const validateOtp = useMutation({ mutationFn: (authorizationCode: string) => api.post(`/financial-requests/${params.id}/pay/validate-otp`, { authorizationCode }), onSuccess: async () => { toast.success('OTP submitted'); setOtpOpen(false); await invalidate(); }, onError: async (e) => { toast.error(e instanceof ApiError ? e.message : 'OTP validation failed'); await invalidate(); } });
  const refresh = useMutation({ mutationFn: () => api.post(`/financial-requests/${params.id}/pay/refresh`, {}), onSuccess: async () => { toast.success('Payment status refreshed'); await invalidate(); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Refresh failed') });

  if (requestQ.isLoading || !request) return <div className="p-8 text-sm text-muted-foreground">Loading request...</div>;

  const pending = request.status === 'PENDING';
  // Bill types can't be paid through Monnify until Bills Payment is activated on the account.
  const typePayable = payableTypes.has(request.type) && (billsEnabled || !billTypes.has(request.type));
  const canPay = can('payments:execute') && request.status === 'APPROVED' && typePayable && ['NOT_INITIATED', 'FAILED'].includes(request.providerStatus);
  const canRefresh = can('payments:execute') && request.status === 'APPROVED' && typePayable && request.providerStatus === 'PROCESSING';

  return <div><PageHeader title="Financial Request" description={`${financialTypeLabel[request.type]} · ${request.category}`}><Button variant="outline" asChild><Link href="/financial-requests"><ArrowLeft className="size-4" /> Back</Link></Button>{canPay && <Button onClick={() => pay.mutate()} disabled={pay.isPending}>{pay.isPending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}{request.providerStatus === 'FAILED' ? 'Retry payment' : 'Pay now'}</Button>}{canRefresh && <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Refresh status</Button>}{can('financial_requests:approve') && pending && <><DecisionDialog title="Approve request" action="approve" icon={<Check className="size-4" />} onSubmit={(note) => decide.mutate({ action: 'approve', note })} pending={decide.isPending} /><DecisionDialog title="Request more info" action="request-info" icon={<MessageSquare className="size-4" />} onSubmit={(note) => decide.mutate({ action: 'request-info', note })} pending={decide.isPending} /><DecisionDialog title="Deny request" action="deny" icon={<X className="size-4" />} onSubmit={(note) => decide.mutate({ action: 'deny', note })} pending={decide.isPending} destructive /></>}</PageHeader><OtpDialog open={otpOpen} onOpenChange={setOtpOpen} onSubmit={(code) => validateOtp.mutate(code)} pending={validateOtp.isPending} /><div className="grid gap-4 lg:grid-cols-[1fr_360px]"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base">Request details <Badge variant={statusVariant[request.status]}>{statusLabel[request.status]}</Badge></CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Field label="Type" value={financialTypeLabel[request.type]} /><Field label="Amount" value={naira(request.amount)} /><Field label="Category" value={request.category} /><Field label="Zone" value={request.subsidiary?.name ?? 'General'} /><Field label="Department" value={request.department ? departmentLabel[request.department] : '-'} /><Field label="Requester" value={request.requestedBy?.name ?? '-'} /><Field label="Vendor" value={request.vendor ?? '-'} /><Field label="Payee" value={request.payeeName ?? request.payerName ?? '-'} /><Field label="Phone" value={request.phoneNumber ?? '-'} /><Field label="Network" value={request.network ?? '-'} /><Field label="Data plan" value={request.dataPlan ?? '-'} /><Field label="Electricity" value={request.disco ? `${request.disco} · ${request.customerId} · ${request.meterType}` : '-'} /><Field label="Provider" value={<span className="inline-flex items-center gap-2"><span>{request.provider}</span><Badge variant={providerStatusVariant[request.providerStatus] ?? 'secondary'}>{request.providerStatus.replaceAll('_', ' ')}</Badge></span>} /><Field label="Merchant ref" value={request.merchantTxRef ?? '-'} /><Field label="Provider ref" value={request.providerReference ?? '-'} /><Field label="Submitted" value={fmtDateTime(request.createdAt)} /><Field label="Decided" value={fmtDateTime(request.decidedAt)} /><div className="sm:col-span-2"><Field label="Description" value={request.description ?? '-'} /></div><div className="sm:col-span-2"><Field label="Decision note" value={request.decisionNote ?? '-'} /></div>{request.expense && <div className="sm:col-span-2"><Button variant="outline" asChild><Link href="/expenses">View created expense</Link></Button></div>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Instructions & comments</CardTitle></CardHeader><CardContent><div className="space-y-3">{request.comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : request.comments.map((c) => <div key={c.id} className="rounded-md border p-3"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-sm font-medium">{c.author?.name ?? 'System'}</span>{c.isInstruction && <Badge variant="warning">Instruction</Badge>}</div><p className="text-sm text-muted-foreground">{c.message}</p><p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(c.createdAt)}</p></div>)}<CommentBox onSubmit={(message) => addComment.mutate(message)} pending={addComment.isPending} /></div></CardContent></Card></div></div>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) { return <div><div className="text-xs font-medium uppercase text-muted-foreground">{label}</div><div className="mt-1 text-sm break-words">{value}</div></div>; }
function DecisionDialog({ title, action, icon, onSubmit, pending, destructive }: { title: string; action: string; icon: React.ReactNode; onSubmit: (note: string) => void; pending: boolean; destructive?: boolean }) { const [open, setOpen] = useState(false); const [note, setNote] = useState(''); return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant={destructive ? 'destructive' : action === 'approve' ? 'default' : 'outline'}>{icon}{title}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div><DialogFooter><Button variant={destructive ? 'destructive' : 'default'} onClick={() => { onSubmit(note); setOpen(false); }} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />}Save decision</Button></DialogFooter></DialogContent></Dialog>; }
function CommentBox({ onSubmit, pending }: { onSubmit: (message: string) => void; pending: boolean }) { const [message, setMessage] = useState(''); return <div className="space-y-2 pt-2"><Textarea placeholder="Add a comment" value={message} onChange={(e) => setMessage(e.target.value)} /><Button size="sm" onClick={() => { onSubmit(message); setMessage(''); }} disabled={!message.trim() || pending}>{pending && <Loader2 className="size-4 animate-spin" />}Add comment</Button></div>; }
function OtpDialog({ open, onOpenChange, onSubmit, pending }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (code: string) => void; pending: boolean }) { const [code, setCode] = useState(''); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Enter payment OTP</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Monnify sent a one-time code to the company&apos;s registered Monnify account email.</p><div className="space-y-1.5"><Label>Authorization code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoFocus /></div><DialogFooter><Button onClick={() => onSubmit(code)} disabled={!code.trim() || pending}>{pending && <Loader2 className="size-4 animate-spin" />}Submit OTP</Button></DialogFooter></DialogContent></Dialog>; }

