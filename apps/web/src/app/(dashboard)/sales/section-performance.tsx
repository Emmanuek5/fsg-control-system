'use client';

import { Loader2 } from 'lucide-react';
import type { SalesBySubsidiaryPoint } from '@fsg/shared';
import { naira, num } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Chart colours, cycled by rank so the biggest earner is always the same hue. */
const BARS = ['bg-primary', 'bg-warning', 'bg-chart-4', 'bg-chart-3', 'bg-chart-5'];

const TYPE_LABEL: Record<string, string> = {
  ONLINE_SHOP: 'Shop',
  FARM_LAYERS: 'Layers',
  FARM_BROILERS: 'Broilers',
  FARM_CROPS: 'Crops',
  FARM_LIVESTOCK: 'Livestock',
  ASSETS: 'Assets',
  LAND_ESTATE: 'Land',
  INVESTMENTS: 'Investments',
};

/**
 * Where the money came from, for whatever period the filters describe.
 *
 * Deliberately shows every section that recorded a sale rather than only the
 * one being filtered to — the point is comparison, and a single row would say
 * nothing about how the shop is doing against the farms.
 */
export function SectionPerformance({
  rows,
  loading,
  periodLabel,
}: {
  rows: SalesBySubsidiaryPoint[];
  loading: boolean;
  periodLabel: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.revenue, 0);
  const transactions = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-baseline justify-between gap-3 space-y-0">
        <CardTitle>Performance by section</CardTitle>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No sales recorded in this period.
          </p>
        ) : (
          <>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{naira(total)}</span>
              <span className="text-sm text-muted-foreground">
                across {num(transactions)} {transactions === 1 ? 'sale' : 'sales'} ·{' '}
                {rows.length} {rows.length === 1 ? 'section' : 'sections'}
              </span>
            </div>

            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={row.subsidiaryId ?? 'unassigned'}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{row.subsidiary}</span>
                      {row.type ? (
                        <Badge variant="secondary">{TYPE_LABEL[row.type] ?? row.type}</Badge>
                      ) : (
                        // Sales recorded before anyone said where they came from.
                        <Badge variant="outline">No section</Badge>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium">{naira(row.revenue)}</span>{' '}
                      <span className="text-xs text-muted-foreground">
                        {(row.share * 100).toFixed(row.share >= 0.1 ? 0 : 1)}% ·{' '}
                        {num(row.count)} {row.count === 1 ? 'sale' : 'sales'}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${BARS[i % BARS.length]}`}
                      style={{ width: `${Math.max(row.share * 100, 1)}%` }}
                    />
                  </div>
                  {row.logistics > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {naira(row.subtotal)} goods + {naira(row.logistics)} logistics
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
