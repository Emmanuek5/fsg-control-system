'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface Bank {
  code: string;
  name: string;
}
export interface DataProduct {
  amount: number;
  plan: string;
}
export interface Disco {
  code: string;
  name: string;
  id?: string;
}

const HOUR = 60 * 60 * 1000;

/** Whether the API has Monnify credentials configured. Drives the auto-resolve UX
 *  (when false, the forms fall back to plain manual entry). `billsEnabled` gates the
 *  airtime/data/electricity request types — off until Monnify activates Bills Payment
 *  on the merchant account; staff request a bank transfer and buy bills themselves. */
export function usePaymentsStatus() {
  return useQuery({
    queryKey: ['payments', 'status'],
    queryFn: () => api.get<{ configured: boolean; billsEnabled: boolean }>('/payments/status'),
    staleTime: HOUR,
  });
}

/** Full bank list — prefetched once and cached (bank codes rarely change). */
export function useBanks(enabled = true) {
  return useQuery({
    queryKey: ['payments', 'banks'],
    queryFn: () => api.get<Bank[]>('/payments/banks'),
    staleTime: 24 * HOUR,
    enabled,
    retry: false,
  });
}

export function useDataProducts(network: string | null | undefined) {
  return useQuery({
    queryKey: ['payments', 'data-plans', network],
    queryFn: () => api.get<DataProduct[]>(`/payments/data-products?network=${encodeURIComponent(network!)}`),
    staleTime: 6 * HOUR,
    enabled: !!network,
    retry: false,
  });
}

export function useDiscos(enabled = true) {
  return useQuery({
    queryKey: ['payments', 'discos'],
    queryFn: () => api.get<Disco[]>('/payments/electricity/discos'),
    staleTime: 24 * HOUR,
    enabled,
    retry: false,
  });
}

export function lookupBankAccount(accountNumber: string, bankCode: string) {
  return api.get<{ accountNumber: string; accountName: string }>(
    `/payments/bank/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`,
  );
}

export function lookupElectricity(disco: string, customerId: string, meterType?: string) {
  const qs = new URLSearchParams({ disco, customerId });
  if (meterType) qs.set('meterType', meterType);
  return api.get<{ customerName: string; productCode: string; validationReference?: string }>(
    `/payments/electricity/validate?${qs.toString()}`,
  );
}

/**
 * Static fallback Nigerian bank list (NIBSS codes) so the bank dropdown always
 * renders even before Monnify credentials are configured. When Monnify is configured
 * the live `/payments/banks` list overrides this.
 */
export const FALLBACK_BANKS: Bank[] = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  { code: '035A', name: 'ALAT by Wema' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '084', name: 'Enterprise Bank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '50211', name: 'Kuda Microfinance Bank' },
  { code: '303', name: 'Lotus Bank' },
  { code: '50515', name: 'Moniepoint MFB' },
  { code: '999991', name: 'PalmPay' },
  { code: '104', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '105', name: 'PremiumTrust Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '999992', name: 'OPay' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'SunTrust Bank' },
  { code: '302', name: 'TAJ Bank' },
  { code: '102', name: 'Titan Trust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
];

/** Static fallback electricity DISCOs so the provider dropdown always renders. */
export const FALLBACK_DISCOS: Disco[] = [
  { code: 'aedc', name: 'Abuja Electricity (AEDC)' },
  { code: 'bedc', name: 'Benin Electricity (BEDC)' },
  { code: 'ekedc', name: 'Eko Electricity (EKEDC)' },
  { code: 'eedc', name: 'Enugu Electricity (EEDC)' },
  { code: 'ibedc', name: 'Ibadan Electricity (IBEDC)' },
  { code: 'ikedc', name: 'Ikeja Electric (IKEDC)' },
  { code: 'jed', name: 'Jos Electricity (JED)' },
  { code: 'kaedco', name: 'Kaduna Electricity (KAEDCO)' },
  { code: 'kedco', name: 'Kano Electricity (KEDCO)' },
  { code: 'phed', name: 'Port Harcourt Electricity (PHED)' },
  { code: 'yedc', name: 'Yola Electricity (YEDC)' },
  { code: 'apl', name: 'Aba Power (APL)' },
];

export type Network = 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';

// Well-known Nigerian mobile prefixes → telco. Number portability means this is a
// best-guess hint the user can always override, not a guarantee.
const PREFIX_TO_NETWORK: Record<string, Network> = {};
const register = (network: Network, prefixes: string[]) =>
  prefixes.forEach((p) => (PREFIX_TO_NETWORK[p] = network));
register('MTN', ['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906', '0913', '0916']);
register('GLO', ['0805', '0807', '0705', '0815', '0811', '0905', '0915']);
register('AIRTEL', ['0802', '0808', '0708', '0812', '0701', '0902', '0901', '0904', '0907', '0912', '0911']);
register('9MOBILE', ['0809', '0818', '0817', '0909', '0908']);

/** Normalise a Nigerian phone number to local 0-prefixed form (e.g. 08031234567). */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('234')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

/** Detect the telco from a phone number, or null if it can't be determined yet. */
export function detectNetwork(raw: string): Network | null {
  const phone = normalisePhone(raw);
  if (phone.length < 4) return null;
  return PREFIX_TO_NETWORK[phone.slice(0, 4)] ?? null;
}



