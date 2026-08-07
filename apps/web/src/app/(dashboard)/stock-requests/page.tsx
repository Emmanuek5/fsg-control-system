'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Plus } from 'lucide-react';
import { MovementType, type ApprovalStatus } from '@fsg/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDateTime, naira, num } from '@/lib/format';
import { movementLabel, statusLabel, statusVariant } from '@/lib/approval';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { StockRequestDialog } from '@/components/stock-request-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface StockRequest {
  id: string;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  status: ApprovalStatus;
  createdAt: string;
  product: { id: string; name: string; sku: string | null; unit: string; quantityOnHand: number };
  variant: { id: string; name: string; packSize: number; quantityOnHand: number } | null;
  subsidiary: { id: string; name: string } | null;
  requestedBy: { id: string; name: string; email: string } | null;
}

export default function StockRequestsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const requestsQ = useQuery({
    queryKey: ['stock-requests', status],
    queryFn: () => api.get<StockRequest[]>(`/stock-requests${status ? `?status=${status}` : ''}`),
  });

  const columns: Column<StockRequest>[] = [
    { header: 'Date', cell: (r) => fmtDateTime(r.createdAt) },
    { header: 'Product', cell: (r) => <div><div className="font-medium">{r.product.name}</div><div className="text-xs text-muted-foreground">{r.variant && r.variant.name !== 'Default' ? r.variant.name : (r.product.sku ?? 'No SKU')}</div></div> },
    { header: 'Type', cell: (r) => movementLabel[r.type] },
    { header: 'Quantity', cell: (r) => `${num(r.quantity)} ${r.product.unit}` },
    { header: 'Unit cost', cell: (r) => r.unitCost != null ? naira(r.unitCost) : '-' },
    { header: 'Requester', cell: (r) => r.requestedBy?.name ?? '-' },
    { header: 'Status', cell: (r) => <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge> },
    { header: '', className: 'text-right', cell: (r) => <Button variant="ghost" size="icon" asChild aria-label="Open request"><Link href={`/stock-requests/${r.id}`}><Eye className="size-4" /></Link></Button> },
  ];

  return (
    <div>
      <PageHeader title="Stock Requests" description="Request stock changes for manager approval before inventory is affected">
        {can('stock_requests:create') && <StockRequestDialog trigger={<Button><Plus className="size-4" /> New request</Button>} />}
      </PageHeader>
      <div className="mb-4 max-w-xs">
        <Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All requests</option>
          <option value="PENDING">Pending</option>
          <option value="NEEDS_INFO">Needs info</option>
          <option value="APPROVED">Approved</option>
          <option value="DENIED">Denied</option>
        </Select>
      </div>
      <DataTable columns={columns} rows={requestsQ.data ?? []} loading={requestsQ.isLoading} empty="No stock requests yet." />
    </div>
  );
}
