'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { FALLBACK_BANKS, lookupBankAccount, useBanks, usePaymentsStatus } from '@/lib/payments';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export interface BankAccountValue {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/**
 * Bank + account fields with Monnify "resolve-as-you-type" name enquiry.
 * Prefetches the bank list; once a bank is picked and a 10-digit account number
 * entered, it auto-resolves the verified account name. Falls back to plain manual
 * entry when Monnify is not configured or a lookup fails.
 */
export function BankAccountFields({
  value,
  onChange,
  accountNameLabel = 'Account name',
}: {
  value: BankAccountValue;
  onChange: (value: BankAccountValue) => void;
  accountNameLabel?: string;
}) {
  const statusQ = usePaymentsStatus();
  const configured = statusQ.data?.configured ?? false;
  const banksQ = useBanks(configured);
  // Always show a bank dropdown: live Monnify list when configured, static list otherwise.
  const banks = banksQ.data ?? FALLBACK_BANKS;
  const canAutoResolve = configured; // name enquiry needs live Monnify

  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const digits = value.accountNumber.replace(/\D/g, '');

  useEffect(() => {
    if (!canAutoResolve || !value.bankCode || digits.length !== 10) {
      setState('idle');
      setError(null);
      return;
    }
    let cancelled = false;
    setState('loading');
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await lookupBankAccount(digits, value.bankCode);
        if (cancelled) return;
        if (res.accountName) {
          onChange({ ...value, accountNumber: digits, accountName: res.accountName });
          setState('ok');
        } else {
          setState('error');
          setError('No account name found — enter it manually');
        }
      } catch (err) {
        if (cancelled) return;
        setState('error');
        setError(err instanceof ApiError ? err.message : 'Could not verify account — enter name manually');
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // onChange/value intentionally excluded: re-run only when the lookup inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoResolve, value.bankCode, digits]);

  return (
    <>
      <div className="space-y-1.5">
        <Label>Bank</Label>
        <Select
          value={value.bankCode}
          onChange={(e) => {
            const bank = banks.find((b) => b.code === e.target.value);
            onChange({ ...value, bankCode: e.target.value, bankName: bank?.name ?? '' });
          }}
        >
          <option value="">Select bank</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Account number</Label>
        <Input
          inputMode="numeric"
          maxLength={10}
          value={value.accountNumber}
          onChange={(e) => onChange({ ...value, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          placeholder="10-digit account number"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="flex items-center gap-1.5">
          {accountNameLabel}
          {state === 'loading' && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          {state === 'ok' && <Check className="size-3.5 text-success" />}
          {state === 'error' && <TriangleAlert className="size-3.5 text-warning" />}
        </Label>
        <Input
          value={value.accountName}
          onChange={(e) => onChange({ ...value, accountName: e.target.value })}
          placeholder={canAutoResolve ? 'Auto-filled after account number' : 'Account holder name'}
          className={state === 'ok' ? 'border-success/60' : undefined}
        />
        {state === 'error' && error && <p className="text-xs text-warning">{error}</p>}
      </div>
    </>
  );
}


