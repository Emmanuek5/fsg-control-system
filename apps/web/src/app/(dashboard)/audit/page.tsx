'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import { Badge } from '@/components/ui/badge';

type Action = 'CREATE' | 'UPDATE' | 'DELETE';

interface AuditRow {
  id: string;
  action: Action;
  entity: string;
  entityId: string | null;
  summary: string;
  actorEmail: string | null;
  createdAt: string;
  actor: { name: string } | null;
}

const actionVariant: Record<Action, 'success' | 'default' | 'destructive'> = {
  CREATE: 'success',
  UPDATE: 'default',
  DELETE: 'destructive',
};

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'CREATE', label: 'Created' },
  { key: 'UPDATE', label: 'Updated' },
  { key: 'DELETE', label: 'Deleted' },
] as const;

export default function AuditPage() {
  const [action, setAction] = useState('');

  const auditQ = useQuery({
    queryKey: ['audit', action],
    queryFn: () => api.get<AuditRow[]>(`/audit${action ? `?action=${action}` : ''}`),
  });

  const columns: Column<AuditRow>[] = [
    { header: 'When', cell: (r) => fmtDateTime(r.createdAt) },
    { header: 'Who', cell: (r) => r.actor?.name ?? r.actorEmail ?? 'System' },
    {
      header: 'Action',
      cell: (r) => <Badge variant={actionVariant[r.action]}>{r.action}</Badge>,
    },
    { header: 'Entity', cell: (r) => r.entity },
    { header: 'Details', cell: (r) => r.summary },
  ];

  return (
    <div>
      <PageHeader title="Audit Log" description="Who changed what across the system">
        <ExportButton
          filename="audit-log"
          rows={auditQ.data ?? []}
          columns={[
            { header: 'When', value: (r) => r.createdAt },
            { header: 'Who', value: (r) => r.actor?.name ?? r.actorEmail ?? 'System' },
            { header: 'Action', value: (r) => r.action },
            { header: 'Entity', value: (r) => r.entity },
            { header: 'Entity ID', value: (r) => r.entityId },
            { header: 'Details', value: (r) => r.summary },
          ]}
        />
      </PageHeader>

      <div className="mb-4 inline-flex rounded-lg border bg-card p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setAction(f.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              action === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={auditQ.data ?? []}
        loading={auditQ.isLoading}
        empty="No audit activity yet."
      />
    </div>
  );
}
