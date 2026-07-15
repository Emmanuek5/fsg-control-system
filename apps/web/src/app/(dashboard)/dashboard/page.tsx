'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Bell,
  Boxes,
  Egg,
  Bird,
  ShoppingCart,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AlertSeverity,
  DashboardKpis,
  EggProductionPoint,
  RecentActivityItem,
  SubsidiaryPerformancePoint,
} from '@fsg/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useChartColors } from '@/lib/chart-theme';
import { naira, num, relativeTime } from '@/lib/format';
import { KpiCard } from '@/components/kpi-card';
import { ChartCard } from '@/components/chart-card';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface AlertRow {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  createdAt: string;
}

const severityVariant: Record<AlertSeverity, 'default' | 'warning' | 'destructive'> = {
  INFO: 'default',
  WARNING: 'warning',
  CRITICAL: 'destructive',
};

export default function DashboardPage() {
  const { can } = useAuth();
  const canSeeFinance = can('finance:read');

  const kpis = useQuery({
    queryKey: ['kpis'],
    queryFn: () => api.get<DashboardKpis>('/dashboard/kpis'),
  });
  const perf = useQuery({
    queryKey: ['subsidiary-performance'],
    queryFn: () => api.get<SubsidiaryPerformancePoint[]>('/dashboard/subsidiary-performance'),
    enabled: canSeeFinance,
  });
  const eggs = useQuery({
    queryKey: ['egg-trend'],
    queryFn: () => api.get<EggProductionPoint[]>('/dashboard/egg-trend'),
  });
  const activity = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => api.get<RecentActivityItem[]>('/dashboard/recent-activity'),
  });
  const alerts = useQuery({
    queryKey: ['urgent-alerts'],
    queryFn: () => api.get<AlertRow[]>('/dashboard/urgent-alerts'),
  });

  const k = kpis.data;
  const loading = kpis.isLoading;
  const chartColors = useChartColors();

  return (
    <div>
      <PageHeader title="Executive Dashboard" description="Live overview across all subsidiaries" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(loading || k?.totalStockValue != null) && (
          <KpiCard
            title="Total Stock Value"
            value={naira(k?.totalStockValue)}
            icon={Boxes}
            accent="primary"
            loading={loading}
          />
        )}
        {(loading || k?.salesToday != null) && (
          <KpiCard
            title="Sales Today"
            value={naira(k?.salesToday)}
            icon={ShoppingCart}
            hint={k?.salesThisMonth != null ? `${naira(k.salesThisMonth)} this month` : undefined}
            accent="gold"
            loading={loading}
          />
        )}
        <KpiCard
          title="Birds Alive"
          value={num(k?.birdsAlive ?? 0)}
          icon={Bird}
          accent="sage"
          loading={loading}
        />
        <KpiCard
          title="Eggs (7 days)"
          value={num(k?.eggsThisWeek ?? 0)}
          icon={Egg}
          accent="sage"
          loading={loading}
        />
        <KpiCard
          title="Overdue Maintenance"
          value={num(k?.overdueMaintenance ?? 0)}
          icon={Wrench}
          accent={(k?.overdueMaintenance ?? 0) > 0 ? 'terracotta' : 'neutral'}
          loading={loading}
        />
        {(loading || k?.unpaidLandBalance != null) && (
          <KpiCard
            title="Unpaid Land Balance"
            value={naira(k?.unpaidLandBalance)}
            icon={Banknote}
            accent="terracotta"
            loading={loading}
          />
        )}
        {(loading || k?.investmentsNearingMaturity != null) && (
          <KpiCard
            title="Investments Maturing"
            value={num(k?.investmentsNearingMaturity)}
            icon={TrendingUp}
            hint="within 30 days"
            accent="primary"
            loading={loading}
          />
        )}
        <KpiCard
          title="Active Alerts"
          value={num(k?.activeAlerts ?? 0)}
          icon={Bell}
          accent={(k?.activeAlerts ?? 0) > 0 ? 'destructive' : 'neutral'}
          loading={loading}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {canSeeFinance && (
          <ChartCard title="Revenue by Subsidiary">
            <div className="h-72">
              {perf.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perf.data ?? []} margin={{ left: 8, right: 8, top: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartColors.grid}
                    />
                    <XAxis
                      dataKey="subsidiary"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      height={50}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip formatter={(v: number) => naira(v)} />
                    <Bar dataKey="revenue" fill={chartColors.chart1} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        )}

        <ChartCard
          title="Egg Production (14 days)"
          className={canSeeFinance ? undefined : 'lg:col-span-2'}
        >
          <div className="h-72">
            {eggs.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={eggs.data ?? []} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })
                    }
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${num(v)} eggs`} />
                  <Line
                    type="monotone"
                    dataKey="eggs"
                    stroke={chartColors.chart2}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (activity.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <ul className="divide-y">
                {activity.data!.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(item.occurredAt)}
                      </p>
                    </div>
                    {item.amount != null && (
                      <span className="shrink-0 text-sm font-medium text-success">
                        {naira(item.amount)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" />
              Urgent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (alerts.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active alerts 🎉</p>
            ) : (
              <ul className="space-y-2.5">
                {alerts.data!.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      {a.message && <p className="text-xs text-muted-foreground">{a.message}</p>}
                    </div>
                    <Badge variant={severityVariant[a.severity]} className="shrink-0">
                      {a.severity}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
