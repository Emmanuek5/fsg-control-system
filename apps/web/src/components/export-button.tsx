'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/csv';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export function ExportButton<T>({
  filename,
  rows,
  columns,
  label = 'Export CSV',
}: {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  label?: string;
}) {
  return (
    <Button
      variant="outline"
      disabled={!rows || rows.length === 0}
      onClick={() =>
        downloadCsv(
          filename,
          columns.map((c) => c.header),
          rows.map((r) => columns.map((c) => c.value(r))),
        )
      }
    >
      <Download className="size-4" /> {label}
    </Button>
  );
}
