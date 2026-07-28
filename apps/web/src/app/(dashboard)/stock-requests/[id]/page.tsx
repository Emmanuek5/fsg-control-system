'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ApprovalStatus, MovementType } from '@fsg/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime, naira, num } from '@/lib/format';
import { movementLabel, statusLabel, statusVariant } from '@/lib/approval';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Comment { id: string; message: string; isInstruction: boolean; createdAt: string; author: { id: string; name: string } | null; }
interface StockRequest {
  id: string;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  note: string | null;
  receiptUrl: string | null;
  status: ApprovalStatus;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  product: { id: string; name: string; sku: string | null; unit: string; quantityOnHand: number };
  variant: { id: string; name: string; packSize: number; quantityOnHand: number } | null;
  subsidiary: { id: string; name: string } | null;
  requestedBy: { id: string; name: string; email: string } | null;
  approvedBy: { id: string; name: string; email: string } | null;
  inventoryMovement: { id: string; occurredAt: string } | null;
  comments: Comment[];
}

export default function StockRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const qc = useQueryClient();
  const requestQ = useQuery({ queryKey: ['stock-request', params.id], queryFn: () => api.get<StockRequest>(`/stock-requests/${params.id}`) });
  const request = requestQ.data;

  const decide = useMutation({
    mutationFn: ({ action, note }: { action: 'approve' | 'deny' | 'request-info'; note: string }) => api.post(`/stock-requests/${params.id}/${action}`, { note: note || null }),
    onSuccess: async () => {
      toast.success('Decision saved');
      await qc.invalidateQueries({ queryKey: ['stock-request', params.id] });
      await qc.invalidateQueries({ queryKey: ['stock-requests'] });
      await qc.invalidateQueries({ queryKey: ['movements'] });
      await qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Decision failed'),
  });

  const addComment = useMutation({
    mutationFn: (message: string) => api.post(`/stock-requests/${params.id}/comments`, { message, isInstruction: false }),
    onSuccess: async () => {
      toast.success('Comment added');
      await qc.invalidateQueries({ queryKey: ['stock-request', params.id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Comment failed'),
  });

  if (requestQ.isLoading || !request) return <div className="p-8 text-sm text-muted-foreground">Loading request...</div>;
  const pending = request.status === 'PENDING';

  return (
    <div>
      <PageHeader title="Stock Request" description={`${request.product.name} · ${movementLabel[request.type]}`}>
        <Button variant="outline" asChild><Link href="/stock-requests"><ArrowLeft className="size-4" /> Back</Link></Button>
        {can('stock_requests:approve') && pending && (
          <>
            <DecisionDialog title="Approve request" action="approve" icon={<Check className="size-4" />} onSubmit={(note) => decide.mutate({ action: 'approve', note })} pending={decide.isPending} />
            <DecisionDialog title="Request more info" action="request-info" icon={<MessageSquare className="size-4" />} onSubmit={(note) => decide.mutate({ action: 'request-info', note })} pending={decide.isPending} />
            <DecisionDialog title="Deny request" action="deny" icon={<X className="size-4" />} onSubmit={(note) => decide.mutate({ action: 'deny', note })} pending={decide.isPending} destructive />
          </>
        )}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">Request details <Badge variant={statusVariant[request.status]}>{statusLabel[request.status]}</Badge></CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Product" value={request.product.name} />
            <Field label="Variant" value={request.variant?.name ?? '—'} />
            <Field label="Current stock" value={`${num(request.product.quantityOnHand)} ${request.product.unit}`} />
            <Field label="Movement" value={movementLabel[request.type]} />
            <Field label="Quantity" value={`${num(request.quantity)} ${request.product.unit}`} />
            <Field label="Unit cost" value={request.unitCost != null ? naira(request.unitCost) : '-'} />
            <Field label="Reference" value={request.reference ?? '-'} />
            <Field label="Zone" value={request.subsidiary?.name ?? 'General'} />
            <Field label="Requested by" value={request.requestedBy?.name ?? '-'} />
            <Field label="Submitted" value={fmtDateTime(request.createdAt)} />
            <Field label="Decided" value={fmtDateTime(request.decidedAt)} />
            <div className="sm:col-span-2"><Field label="Reason" value={request.note ?? '-'} /></div>
            <div className="sm:col-span-2"><Field label="Decision note" value={request.decisionNote ?? '-'} /></div>
            {request.inventoryMovement && <div className="sm:col-span-2"><Button variant="outline" asChild><Link href="/stock-movements">View posted movement</Link></Button></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Instructions & comments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {request.comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : request.comments.map((c) => (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2"><span className="text-sm font-medium">{c.author?.name ?? 'System'}</span>{c.isInstruction && <Badge variant="warning">Instruction</Badge>}</div>
                  <p className="text-sm text-muted-foreground">{c.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(c.createdAt)}</p>
                </div>
              ))}
              <CommentBox onSubmit={(message) => addComment.mutate(message)} pending={addComment.isPending} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-xs font-medium uppercase text-muted-foreground">{label}</div><div className="mt-1 text-sm">{value}</div></div>;
}

function DecisionDialog({ title, action, icon, onSubmit, pending, destructive }: { title: string; action: string; icon: React.ReactNode; onSubmit: (note: string) => void; pending: boolean; destructive?: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant={destructive ? 'destructive' : action === 'approve' ? 'default' : 'outline'}>{icon}{title}</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="space-y-1.5"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div><DialogFooter><Button variant={destructive ? 'destructive' : 'default'} onClick={() => { onSubmit(note); setOpen(false); }} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />}Save decision</Button></DialogFooter></DialogContent>
    </Dialog>
  );
}

function CommentBox({ onSubmit, pending }: { onSubmit: (message: string) => void; pending: boolean }) {
  const [message, setMessage] = useState('');
  return <div className="space-y-2 pt-2"><Textarea placeholder="Add a comment" value={message} onChange={(e) => setMessage(e.target.value)} /><Button size="sm" onClick={() => { onSubmit(message); setMessage(''); }} disabled={!message.trim() || pending}>{pending && <Loader2 className="size-4 animate-spin" />}Add comment</Button></div>;
}
