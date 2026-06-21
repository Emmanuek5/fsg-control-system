export const naira = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export const num = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-NG').format(n ?? 0);

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d
    ? new Date(d).toLocaleString('en-NG', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** Format a date value for an <input type="date"> (YYYY-MM-DD). */
export const toDateInput = (d: string | Date | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : '';

export const relativeTime = (d: string | Date) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};
