import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

interface NombaHeaders {
  signature?: string;
  algorithm?: string;
  version?: string;
  timestamp?: string;
}

/** @deprecated Nomba webhooks are kept temporarily for legacy provider callbacks. */
@Injectable()
export class NombaWebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return { ok: true, provider: 'NOMBA', webhook: 'ready' };
  }

  async handleWebhook(payload: any, rawBody: Buffer | undefined, headers: NombaHeaders) {
    if (this.isSetupProbe(payload, headers)) {
      return { ok: true, provider: 'NOMBA', webhook: 'setup-probe' };
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Invalid webhook payload');
    }

    const verificationStatus = this.verifySignature(rawBody, headers);
    const eventType = String(payload.event_type ?? payload.eventType ?? 'unknown');
    const transaction = payload.data?.transaction ?? {};
    const merchantTxRef = transaction.merchantTxRef ?? payload.data?.merchantTxRef ?? null;
    const providerReference = transaction.transactionId ?? transaction.id ?? payload.data?.transactionId ?? null;
    const eventId = String(
      payload.request_id ??
        payload.requestId ??
        providerReference ??
        merchantTxRef ??
        `${eventType}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    );
    const providerTimestamp = this.parseDate(headers.timestamp ?? transaction.time ?? payload.data?.time);

    const existing = await this.prisma.paymentProviderEvent.findUnique({
      where: { provider_eventId: { provider: 'NOMBA', eventId } },
    });
    if (existing) {
      return { ok: true, duplicate: true, eventId, eventType };
    }

    const financialRequest = await this.findFinancialRequest(merchantTxRef, providerReference);
    const providerStatus = this.mapProviderStatus(eventType);

    const event = await this.prisma.$transaction(async (tx) => {
      let updatedFinancialRequestId = financialRequest?.id ?? null;
      if (financialRequest && providerStatus) {
        await tx.financialRequest.update({
          where: { id: financialRequest.id },
          data: {
            providerStatus,
            providerReference: providerReference ?? financialRequest.providerReference,
            providerResponse: payload,
          },
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
          provider: 'NOMBA',
          eventId,
          eventType,
          signature: headers.signature ?? null,
          signatureAlgorithm: headers.algorithm ?? null,
          signatureVersion: headers.version ?? null,
          providerTimestamp,
          verificationStatus,
          payload,
          merchantTxRef,
          providerReference,
          financialRequestId: updatedFinancialRequestId,
          processedAt: new Date(),
        },
      });
    });

    return {
      ok: true,
      duplicate: false,
      eventId: event.eventId,
      eventType: event.eventType,
      matchedFinancialRequestId: event.financialRequestId,
      verificationStatus: event.verificationStatus,
    };
  }

  private verifySignature(rawBody: Buffer | undefined, headers: NombaHeaders): 'VERIFIED' | 'FAILED' | 'SKIPPED' {
    const secret = process.env.NOMBA_WEBHOOK_SIGNATURE_KEY;
    if (!secret) return 'SKIPPED';
    if (!headers.signature || !rawBody) throw new UnauthorizedException('Missing Nomba webhook signature');

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = headers.signature.trim();
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(received, 'hex');
    const verified =
      expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!verified) throw new UnauthorizedException('Invalid Nomba webhook signature');
    return 'VERIFIED';
  }

  private isSetupProbe(payload: unknown, headers: NombaHeaders) {
    if (headers.signature) return false;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return true;

    const eventLikePayload = payload as {
      event_type?: unknown;
      eventType?: unknown;
      request_id?: unknown;
      requestId?: unknown;
      data?: unknown;
    };

    return !(
      eventLikePayload.event_type ||
      eventLikePayload.eventType ||
      eventLikePayload.request_id ||
      eventLikePayload.requestId ||
      eventLikePayload.data
    );
  }

  private mapProviderStatus(eventType: string): 'SUCCESS' | 'FAILED' | 'PROCESSING' | null {
    const normalized = eventType.toLowerCase();
    if (normalized.includes('success')) return 'SUCCESS';
    if (normalized.includes('failed') || normalized.includes('refund')) return 'FAILED';
    if (normalized.includes('pending') || normalized.includes('processing')) return 'PROCESSING';
    return null;
  }

  private parseDate(value: unknown): Date | null {
    if (!value || typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private findFinancialRequest(merchantTxRef?: string | null, providerReference?: string | null) {
    if (!merchantTxRef && !providerReference) return null;
    return this.prisma.financialRequest.findFirst({
      where: {
        OR: [
          ...(merchantTxRef ? [{ merchantTxRef }] : []),
          ...(providerReference ? [{ providerReference }] : []),
        ],
      },
      select: { id: true, expenseId: true, providerReference: true },
    });
  }
}

