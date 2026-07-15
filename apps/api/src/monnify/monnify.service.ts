import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const PATHS = {
  auth: '/api/v1/auth/login',
  banks: '/api/v1/banks',
  accountValidate: '/api/v1/disbursements/account/validate',
  singleTransfer: '/api/v2/disbursements/single',
  validateTransferOtp: '/api/v2/disbursements/single/validate-otp',
  resendTransferOtp: '/api/v2/disbursements/single/resend-otp',
  transferSummary: '/api/v2/disbursements/single/summary',
  walletBalance: '/api/v2/disbursements/wallet-balance',
  transactionQuery: '/api/v2/merchant/transactions/query',
  billerCategories: '/api/v1/vas/bills-payment/biller-categories',
  billers: '/api/v1/vas/bills-payment/billers',
  billerProducts: '/api/v1/vas/bills-payment/biller-products',
  validateBillCustomer: '/api/v1/vas/bills-payment/validate-customer',
  vendBill: '/api/v1/vas/bills-payment/vend',
  billRequery: '/api/v1/vas/bills-payment/requery',
} as const;

export interface MonnifyBank { name: string; code: string; }
export interface MonnifyAccountName { accountNumber: string; accountName: string; bankCode: string; }
export interface MonnifyBillerCategory { categoryCode?: string; code?: string; name?: string; categoryName?: string; }
export interface MonnifyBiller { billerCode?: string; code?: string; name?: string; billerName?: string; }
export interface MonnifyBillerProduct { productCode?: string; code?: string; name?: string; productName?: string; amount?: number; }
export interface MonnifyBillCustomer { customerName?: string; requireValidationRef?: boolean; validationReference?: string; }
export interface MonnifyBillVend { vendStatus?: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS'; transactionReference?: string; reference?: string; }
export interface MonnifyTransfer { status?: 'SUCCESS' | 'PENDING_AUTHORIZATION' | 'FAILED' | 'PENDING'; reference?: string; transactionReference?: string; }
export interface MonnifyWalletBalance { availableBalance: number; ledgerBalance: number; }

interface CachedToken { token: string; expiresAt: number; }
interface Cache<T> { value: T; expiresAt: number; }

@Injectable()
export class MonnifyService {
  private readonly logger = new Logger(MonnifyService.name);
  private tokenCache: CachedToken | null = null;
  private banksCache: Cache<MonnifyBank[]> | null = null;
  private categoriesCache: Cache<MonnifyBillerCategory[]> | null = null;
  private billersCache = new Map<string, Cache<MonnifyBiller[]>>();
  private productsCache = new Map<string, Cache<MonnifyBillerProduct[]>>();

  private readonly baseUrl = (process.env.MONNIFY_BASE_URL ?? '').replace(/\/+$/, '');
  private readonly apiKey = process.env.MONNIFY_API_KEY ?? '';
  private readonly secretKey = process.env.MONNIFY_SECRET_KEY ?? '';
  private readonly contractCode = process.env.MONNIFY_CONTRACT_CODE ?? '';
  private readonly walletAccountNumber = process.env.MONNIFY_WALLET_ACCOUNT_NUMBER ?? '';

  private static readonly REFERENCE_TTL = 24 * 60 * 60 * 1000;

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.secretKey && this.contractCode);
  }

  /**
   * Bills vending (airtime/data/electricity) is feature-gated: Monnify must activate
   * Bills Payment on the merchant account before /api/v1/vas/* works. Until then the
   * workflow is: request a bank transfer to your own account and purchase it yourself.
   * Flip MONNIFY_BILLS_ENABLED=true once Monnify enables the feature.
   */
  billsEnabled(): boolean {
    return process.env.MONNIFY_BILLS_ENABLED === 'true';
  }

  assertConfigured() {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Monnify is not configured');
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - 60_000 > now) return this.tokenCache.token;

    const basic = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    const res = await fetch(`${this.baseUrl}${PATHS.auth}`, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok || json?.requestSuccessful === false) {
      this.logger.error(`Monnify token request failed (${res.status}): ${text}`);
      throw new ServiceUnavailableException('Could not authenticate with Monnify');
    }
    const body = json?.responseBody ?? json;
    const token = body?.accessToken;
    if (!token) throw new ServiceUnavailableException('Monnify returned no access token');
    const expiresIn = Number(body?.expiresIn ?? 300);
    this.tokenCache = { token, expiresAt: now + expiresIn * 1000 };
    return token;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, opts: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
    this.assertConfigured();
    const token = await this.getToken();
    const qs = opts.query ? `?${new URLSearchParams(opts.query).toString()}` : '';
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}${qs}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      this.logger.error(`Monnify request to ${path} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not reach Monnify');
    }
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok || json?.requestSuccessful === false) {
      const message = json?.responseMessage ?? `Monnify request failed (${res.status})`;
      this.logger.warn(`Monnify ${method} ${path} -> ${res.status}: ${text}`);
      throw new ServiceUnavailableException(message);
    }
    return (json?.responseBody ?? json) as T;
  }

  async listBanks() {
    if (this.banksCache && this.banksCache.expiresAt > Date.now()) return this.banksCache.value;
    const data = await this.request<MonnifyBank[]>('GET', PATHS.banks);
    const banks = Array.isArray(data) ? data : [];
    this.banksCache = { value: banks, expiresAt: Date.now() + MonnifyService.REFERENCE_TTL };
    return banks;
  }

  validateAccount(accountNumber: string, bankCode: string) {
    return this.request<MonnifyAccountName>('GET', PATHS.accountValidate, { query: { accountNumber, bankCode } });
  }

  async listBillerCategories() {
    if (this.categoriesCache && this.categoriesCache.expiresAt > Date.now()) return this.categoriesCache.value;
    const data = await this.request<MonnifyBillerCategory[]>('GET', PATHS.billerCategories);
    const categories = Array.isArray(data) ? data : [];
    this.categoriesCache = { value: categories, expiresAt: Date.now() + MonnifyService.REFERENCE_TTL };
    return categories;
  }

  async listBillers(categoryCode: string) {
    const hit = this.billersCache.get(categoryCode);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const data = await this.request<MonnifyBiller[]>('GET', PATHS.billers, { query: { category_code: categoryCode } });
    const billers = Array.isArray(data) ? data : [];
    this.billersCache.set(categoryCode, { value: billers, expiresAt: Date.now() + MonnifyService.REFERENCE_TTL });
    return billers;
  }

  async listBillerProducts(billerCode: string) {
    const hit = this.productsCache.get(billerCode);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const data = await this.request<MonnifyBillerProduct[]>('GET', PATHS.billerProducts, { query: { biller_code: billerCode } });
    const products = Array.isArray(data) ? data : [];
    this.productsCache.set(billerCode, { value: products, expiresAt: Date.now() + MonnifyService.REFERENCE_TTL });
    return products;
  }

  validateBillCustomer(productCode: string, customerId: string) {
    return this.request<MonnifyBillCustomer>('POST', PATHS.validateBillCustomer, { body: { productCode, customerId } });
  }

  processBill(input: { productCode: string; customerId: string; amount: number; reference: string; validationReference?: string; phoneNumber?: string; emailAddress?: string }) {
    return this.request<MonnifyBillVend>('POST', PATHS.vendBill, { body: input });
  }

  getBillStatus(reference: string) {
    return this.request<any>('GET', PATHS.billRequery, { query: { reference } });
  }

  initiateTransfer(input: { amount: number; reference: string; narration: string; destinationBankCode: string; destinationAccountNumber: string; destinationAccountName: string }) {
    if (!this.walletAccountNumber) throw new ServiceUnavailableException('Monnify wallet account number is not configured');
    // Amounts are naira major units throughout this app and Monnify; pass through unchanged.
    return this.request<MonnifyTransfer>('POST', PATHS.singleTransfer, {
      body: { ...input, currency: 'NGN', sourceAccountNumber: this.walletAccountNumber },
    });
  }

  validateTransferOtp(reference: string, authorizationCode: string) {
    return this.request<MonnifyTransfer>('POST', PATHS.validateTransferOtp, { body: { reference, authorizationCode } });
  }

  resendTransferOtp(reference: string) {
    return this.request<any>('POST', PATHS.resendTransferOtp, { body: { reference } });
  }

  getTransferStatus(reference: string) {
    return this.request<MonnifyTransfer>('GET', PATHS.transferSummary, { query: { reference } });
  }

  getWalletBalance() {
    if (!this.walletAccountNumber) throw new ServiceUnavailableException('Monnify wallet account number is not configured');
    return this.request<MonnifyWalletBalance>('GET', PATHS.walletBalance, { query: { accountNumber: this.walletAccountNumber } });
  }

  queryTransaction(input: { transactionReference?: string; paymentReference?: string }) {
    const query = Object.fromEntries(Object.entries(input).filter(([, v]) => v != null)) as Record<string, string>;
    return this.request<any>('GET', PATHS.transactionQuery, { query });
  }
}
