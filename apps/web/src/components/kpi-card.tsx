import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
  accent = 'bg-primary/10 text-primary',
  loading,
}: {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  accent?: string;
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
              <p className="mt-1 truncate text-2xl font-bold">{value}</p>
            )}
            {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={cn('grid size-10 shrink-0 place-items-center rounded-lg', accent)}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
