import { Hammer } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';

export function ModulePlaceholder({
  title,
  description,
  note = 'The database model and API for this module are already in place — the screen is part of the next build phase.',
}: {
  title: string;
  description: string;
  note?: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Hammer className="size-6" />
          </div>
          <p className="font-medium">Coming in the next phase</p>
          <p className="max-w-md text-sm text-muted-foreground">{note}</p>
        </CardContent>
      </Card>
    </div>
  );
}
