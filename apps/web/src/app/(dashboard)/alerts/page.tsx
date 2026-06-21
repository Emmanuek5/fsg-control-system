'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AlertSeverity } from '@fsg/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { ExportButton } from '@/components/export-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface AlertRow {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

const severityVariant: Record<AlertSeverity, 'default' | 'warning' | 'destructive'> = {
  INFO: 'default',
  WARNING: 'warning',
  CRITICAL: 'destructive',
};

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
] as const;

export default function AlertsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');

  const alertsQ = useQuery({
    queryKey: ['alerts', filter],
    queryFn: () => api.get<AlertRow[]>(`/alerts?status=${filter}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['alerts'] });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, boolean> }) => api.patch(`/alerts/${id}`, body),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/alerts/${id}`),
    onSuccess: async () => {
      toast.success('Alert deleted');
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const generate = useMutation({
    mutationFn: () => api.post<{ active: number; cleared: number }>('/alerts/generate'),
    onSuccess: async (r) => {
      toast.success(`Checks complete — ${r.active} active, ${r.cleared} cleared`);
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Check failed'),
  });

  return (
    <div>
      <PageHeader title="Alerts" description="System alerts across all subsidiaries">
        <ExportButton
          filename="alerts"
          rows={alertsQ.data ?? []}
          columns={[
            { header: 'Severity', value: (a) => a.severity },
            { header: 'Type', value: (a) => a.type },
            { header: 'Title', value: (a) => a.title },
            { header: 'Message', value: (a) => a.message },
            { header: 'Created', value: (a) => a.createdAt },
            { header: 'Resolved', value: (a) => (a.isResolved ? 'yes' : 'no') },
          ]}
        />
        {can('alerts:update') && (
          <Button variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Run checks
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 inline-flex rounded-lg border bg-card p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {alertsQ.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (alertsQ.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No {filter === 'all' ? '' : filter} alerts. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alertsQ.data!.map((a) => (
            <Card key={a.id} className={cn(a.isResolved && 'opacity-60')}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={severityVariant[a.severity]}>{a.severity}</Badge>
                    {!a.isRead && !a.isResolved && <span className="size-2 rounded-full bg-primary" />}
                    {a.isResolved && <Badge variant="success">Resolved</Badge>}
                    <span className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 font-medium">{a.title}</p>
                  {a.message && <p className="text-sm text-muted-foreground">{a.message}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {can('alerts:update') && !a.isRead && !a.isResolved && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Mark read"
                      title="Mark read"
                      onClick={() => patch.mutate({ id: a.id, body: { isRead: true } })}
                    >
                      <Check className="size-4" />
                    </Button>
                  )}
                  {can('alerts:update') && !a.isResolved && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Resolve"
                      title="Resolve"
                      onClick={() => patch.mutate({ id: a.id, body: { isResolved: true, isRead: true } })}
                    >
                      <CheckCheck className="size-4" />
                    </Button>
                  )}
                  {can('alerts:delete') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label="Delete"
                      title="Delete"
                      onClick={() => remove.mutate(a.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
