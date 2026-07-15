'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Notification { id: string; title: string; message: string | null; href: string | null; isRead: boolean; createdAt: string; type: string; }

export default function NotificationsPage() {
  const qc = useQueryClient();
  const notificationsQ = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<Notification[]>('/notifications') });
  const markOne = useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}`, { isRead: true }), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['notifications'] }); await qc.invalidateQueries({ queryKey: ['notifications-unread-count'] }); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update notification') });
  const markAll = useMutation({ mutationFn: () => api.post('/notifications/mark-all-read'), onSuccess: async () => { toast.success('Notifications marked read'); await qc.invalidateQueries({ queryKey: ['notifications'] }); await qc.invalidateQueries({ queryKey: ['notifications-unread-count'] }); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update notifications') });
  const rows = notificationsQ.data ?? [];
  return <div><PageHeader title="Notifications" description="Request decisions, instructions and action items"><Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending || rows.every((n) => n.isRead)}><CheckCheck className="size-4" /> Mark all read</Button></PageHeader><div className="space-y-3">{notificationsQ.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading notifications...</CardContent></Card> : rows.length === 0 ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No notifications yet.</CardContent></Card> : rows.map((n) => <Card key={n.id} className={!n.isRead ? 'border-primary/40 bg-primary/5' : undefined}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="mb-1 flex items-center gap-2"><h2 className="truncate text-sm font-semibold">{n.title}</h2>{!n.isRead && <Badge variant="default">Unread</Badge>}</div>{n.message && <p className="text-sm text-muted-foreground">{n.message}</p>}<p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</p></div><div className="flex shrink-0 gap-2">{!n.isRead && <Button variant="outline" size="sm" onClick={() => markOne.mutate(n.id)}>Mark read</Button>}{n.href && <Button size="sm" asChild><Link href={n.href}>Open <ArrowRight className="size-4" /></Link></Button>}</div></CardContent></Card>)}</div></div>;
}
