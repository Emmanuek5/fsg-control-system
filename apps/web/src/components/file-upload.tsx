'use client';

import { useRef, useState } from 'react';
import { Loader2, Paperclip, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, fileUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function FileUpload({
  value,
  onChange,
  accept,
  label = 'Upload file',
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const isImage = accept?.includes('image');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const res = await api.upload<{ url: string }>('/uploads', file);
      onChange(res.url);
      toast.success('File uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {label}
        </Button>
        {value && (
          <a
            href={fileUrl(value)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-primary underline"
          >
            <Paperclip className="size-3" /> View
          </a>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove file"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {value && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(value)} alt="preview" className="h-20 rounded-md border object-cover" />
      )}
    </div>
  );
}
