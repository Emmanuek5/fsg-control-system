import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type KpiAccent = 'primary' | 'gold' | 'terracotta' | 'sage' | 'destructive' | 'neutral';

/** Restrained accent system — money reads green/gold, risk reads terracotta/red. */
const ACCENTS: Record<KpiAccent, string> = {
  primary: 'bg-primary/10 text-primary',
  gold: 'bg-warning/15 text-warning',
  terracotta: 'bg-chart-3/15 text-chart-3',
  sage: 'bg-chart-4/20 text-primary dark:text-chart-4',
  destructive: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
  accent = 'neutral',
  loading,
}: {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  accent?: KpiAccent;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-24" />
            ) : (
              <p className="mt-1 truncate font-display text-2xl font-bold tabular-nums">{value}</p>
            )}
            {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={cn('grid size-10 shrink-0 place-items-center rounded-lg', ACCENTS[accent])}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
