import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MonnifyService } from '../monnify/monnify.service';

@Injectable()
export class MonnifyWebhooksService {
  private readonly logger = new Logger(MonnifyWebhooksService.name);
  private readonly secret = process.env.MONNIFY_WEBHOOK_SECRET || process.env.MONNIFY_SECRET_KEY || '';
  private readonly env = process.env.MONNIFY_ENV ?? 'sandbox';

  constructor(
    private readonly prisma: PrismaService,
    private readonly monnify: MonnifyService,
    private readonly notifications: NotificationsService,
  ) {}

  health() {
    return { ok: true, provider: 'MONNIFY', webhook: 'ready' };
  }

  async handleWebhook(payload: any, rawBody: Buffer | undefined, signature?: string) {
    if (this.isSetupProbe(payload, signature)) return { ok: true, provider: 'MONNIFY', webhook: 'setup-probe' };
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequestException('Invalid webhook payload');

    const verificationStatus = this.verifySignature(rawBody, signature);
    const eventType = String(payload.eventType ?? 'unknown');
    const eventData = payload.eventData ?? {};
    const incomingReference = eventData.reference ?? eventData.paymentReference ?? null;
    const providerReference = eventData.transactionReference ?? eventData.reference ?? null;
    const eventId = String(eventData.transactionReference ?? eventData.reference ?? eventData.paymentReference ?? `${eventType}:${Date.now()}:${Math.random().toString(36).slice(2)}`);

    const existing = await this.prisma.paymentProviderEvent.findUnique({ where: { provider_eventId: { provider: 'MONNIFY', eventId } } });
    if (existing) return { ok: true, duplicate: true, eventId, eventType };

    const financialRequest = await this.findFinancialRequest(incomingReference, providerReference);
    let providerStatus = this.mapProviderStatus(eventType);
    if (financialRequest && providerStatus === 'SUCCESS') {
      providerStatus = await this.reverify(financialRequest.type, incomingReference ?? providerReference, eventData) ?? 'PROCESSING';
    }

    const event = await this.prisma.$transaction(async (tx) => {
      let updatedFinancialRequestId = financialRequest?.id ?? null;
      if (financialRequest && providerStatus) {
        await tx.financialRequest.update({
          where: { id: financialRequest.id },
          data: { providerStatus, providerReference: providerReference ?? financialRequest.providerReference, providerResponse: payload },
        });
        if (financialRequest.expenseId) {
          await tx.expense.update({
            where: { id: financialRequest.expenseId },
            data: { paymentStatus: providerStatus === 'SUCCESS' ? 'PAID' : providerStatus === 'FAILED' ? 'FAILED' : 'PROCESSING' },
          });
        }
      }

      return tx.paymentProviderEvent.create({
        data: {
          provider: 'MONNIFY',
          eventId,
          eventType,
          signature: signature ?? null,
          signatureAlgorithm: 'SHA-512',
          signatureVersion: null,
          providerTimestamp: this.parseDate(eventData.paidOn ?? eventData.completedOn ?? eventData.createdOn),
          verificationStatus,
          payload,
          merchantTxRef: incomingReference,
          providerReference,
          financialRequestId: updatedFinancialRequestId,
          processedAt: new Date(),
        },
      });
    });

    if (financialRequest && (providerStatus === 'SUCCESS' || providerStatus === 'FAILED')) {
      await this.notifications.notifyUser(financialRequest.requestedById, {
        type: 'PAYMENT_STATUS',
        title: providerStatus === 'SUCCESS' ? 'Payment succeeded' : 'Payment failed',
        message: `Payment for "${financialRequest.category}" ${providerStatus === 'SUCCESS' ? 'succeeded' : 'failed'}.`,
        entityType: 'FINANCIAL_REQUEST',
        entityId: financialRequest.id,
        href: `/financial-requests/${financialRequest.id}`,
      });
    }

    return { ok: true, duplicate: false, eventId: event.eventId, eventType: event.eventType, matchedFinancialRequestId: event.financialRequestId, verificationStatus: event.verificationStatus };
  }

  private verifySignature(rawBody: Buffer | undefined, signature?: string): 'VERIFIED' | 'FAILED' | 'SKIPPED' {
    if (!this.secret) return 'SKIPPED';
    if (!signature || !rawBody) {
      if (this.env === 'production') throw new UnauthorizedException('Missing Monnify webhook signature');
      return 'SKIPPED';
    }
    const expected = createHash('sha512').update(this.secret + rawBody.toString('utf8')).digest('hex');
    const received = signature.trim();
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(received, 'hex');
    const verified = expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!verified) throw new UnauthorizedException('Invalid Monnify webhook signature');
    return 'VERIFIED';
  }

  private isSetupProbe(payload: unknown, signature?: string) {
    if (signature) return false;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return true;
    return !(payload as { eventType?: unknown }).eventType;
  }

  private mapProviderStatus(eventType: string): 'SUCCESS' | 'FAILED' | 'PROCESSING' | null {
    const normalized = eventType.toUpperCase();
    if (normalized.includes('SUCCESSFUL')) return 'SUCCESS';
    if (normalized.includes('FAILED') || normalized.includes('REVERSED')) return 'FAILED';
    if (normalized.includes('PENDING') || normalized.includes('PROCESSING')) return 'PROCESSING';
    return null;
  }

  private async reverify(type: string, reference: string | null, eventData: any): Promise<'SUCCESS' | 'FAILED' | 'PROCESSING' | null> {
    if (!reference || !this.monnify.isConfigured()) return 'SUCCESS';
    try {
      const response = type === 'BANK_TRANSFER' ? await this.monnify.getTransferStatus(reference) : await this.monnify.getBillStatus(reference);
      const value = String(response?.status ?? response?.vendStatus ?? response?.paymentStatus ?? '').toUpperCase();
      if (value === 'SUCCESS' || value === 'SUCCESSFUL') return 'SUCCESS';
      if (value === 'FAILED' || value === 'REVERSED') return 'FAILED';
      return 'PROCESSING';
    } catch (err) {
      this.logger.warn(`Monnify webhook reverify failed: ${(err as Error).message}`);
      return 'PROCESSING';
    }
  }

  private parseDate(value: unknown): Date | null {
    if (!value || typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async findFinancialRequest(merchantTxRef?: string | null, providerReference?: string | null) {
    if (!merchantTxRef && !providerReference) return null;
    const stripped = merchantTxRef?.replace(/-R\d+$/, '') ?? null;
    return this.prisma.financialRequest.findFirst({
      where: {
        OR: [
          ...(merchantTxRef ? [{ merchantTxRef }] : []),
          ...(stripped && stripped !== merchantTxRef ? [{ merchantTxRef: stripped }] : []),
          ...(providerReference ? [{ providerReference }] : []),
        ],
      },
      select: { id: true, type: true, category: true, expenseId: true, requestedById: true, providerReference: true },
    });
  }
}
