'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Banknote, Boxes } from 'lucide-react';
import type { FinancialRequestType, MovementType } from '@fsg/shared';
import { api } from '@/lib/api';
import { fmtDateTime, naira, num } from '@/lib/format';
import { financialTypeLabel, movementLabel } from '@/lib/approval';
import { PageHeader } from '@/components/page-header';
import { KpiCard } from '@/components/kpi-card';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StockRequest { id: string; type: MovementType; quantity: number; createdAt: string; product: { name: string; unit: string }; requestedBy: { name: string } | null; }
interface FinancialRequest { id: string; type: FinancialRequestType; amount: number; category: string; createdAt: string; requestedBy: { name: string } | null; }

export default function ApprovalsPage() {
  const stockQ = useQuery({ queryKey: ['stock-requests', 'PENDING'], queryFn: () => api.get<StockRequest[]>('/stock-requests?status=PENDING') });
  const financialQ = useQuery({ queryKey: ['financial-requests', 'PENDING'], queryFn: () => api.get<FinancialRequest[]>('/financial-requests?status=PENDING') });
  const stockColumns: Column<StockRequest>[] = [
    { header: 'Submitted', cell: (r) => fmtDateTime(r.createdAt) },
    { header: 'Product', cell: (r) => r.product.name },
    { header: 'Change', cell: (r) => <Badge variant="secondary">{movementLabel[r.type]}</Badge> },
    { header: 'Quantity', cell: (r) => `${num(r.quantity)} ${r.product.unit}` },
    { header: 'Requester', cell: (r) => r.requestedBy?.name ?? '-' },
    { header: '', className: 'text-right', cell: (r) => <Button size="sm" asChild><Link href={`/stock-requests/${r.id}`}>Review <ArrowRight className="size-4" /></Link></Button> },
  ];
  const financialColumns: Column<FinancialRequest>[] = [
    { header: 'Submitted', cell: (r) => fmtDateTime(r.createdAt) },
    { header: 'Type', cell: (r) => financialTypeLabel[r.type] },
    { header: 'Category', cell: (r) => r.category },
    { header: 'Amount', cell: (r) => naira(r.amount), className: 'font-medium' },
    { header: 'Requester', cell: (r) => r.requestedBy?.name ?? '-' },
    { header: '', className: 'text-right', cell: (r) => <Button size="sm" asChild><Link href={`/financial-requests/${r.id}`}>Review <ArrowRight className="size-4" /></Link></Button> },
  ];
  return <div><PageHeader title="Approvals" description="Pending stock and financial requests awaiting manager decision" /><div className="mb-6 grid gap-4 sm:grid-cols-2"><KpiCard title="Pending stock" value={num(stockQ.data?.length ?? 0)} icon={Boxes} accent="primary" loading={stockQ.isLoading} /><KpiCard title="Pending financial" value={num(financialQ.data?.length ?? 0)} icon={Banknote} accent="gold" loading={financialQ.isLoading} /></div><div className="space-y-6"><section><h2 className="mb-3 text-base font-semibold">Stock requests</h2><DataTable columns={stockColumns} rows={stockQ.data ?? []} loading={stockQ.isLoading} empty="No pending stock requests." /></section><section><h2 className="mb-3 text-base font-semibold">Financial requests</h2><DataTable columns={financialColumns} rows={financialQ.data ?? []} loading={financialQ.isLoading} empty="No pending financial requests." /></section></div></div>;
}
