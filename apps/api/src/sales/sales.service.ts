import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSaleDto, SaleChannel, VerifySalesDayDto } from '@fsg/shared';
import { claimStock, effectiveUnitPrice, releaseStock, resolveStock } from '../inventory/stock';
import { PrismaService } from '../prisma/prisma.service';

const include = {
  items: {
    include: {
      product: { select: { id: true, name: true, unit: true } },
      variant: { select: { id: true, name: true, packSize: true } },
    },
  },
  customer: { select: { id: true, name: true, phone: true, city: true } },
  subsidiary: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
};

interface SalesFilters {
  from?: string;
  to?: string;
  channel?: string;
  productId?: string;
  customerId?: string;
  subsidiaryId?: string;
  verified?: string;
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  list(filters: SalesFilters) {
    return this.prisma.sale.findMany({
      where: {
        ...(filters.from || filters.to
          ? {
              soldAt: {
                ...(filters.from ? { gte: this.filterDate(filters.from) } : {}),
                ...(filters.to ? this.toFilter(filters.to) : {}),
              },
            }
          : {}),
        ...(filters.channel ? { channel: filters.channel as SaleChannel } : {}),
        ...(filters.productId ? { items: { some: { productId: filters.productId } } } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.subsidiaryId ? { subsidiaryId: filters.subsidiaryId } : {}),
        ...(filters.verified === 'true'
          ? { verifiedAt: { not: null } }
          : filters.verified === 'false'
            ? { verifiedAt: null }
            : {}),
      },
      orderBy: { soldAt: 'desc' },
      take: 500,
      include,
    });
  }

  async summary() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayWhere = { soldAt: { gte: startOfDay, lt: nextDay } };

    const [today, todayCount, month, unverifiedToday] = await Promise.all([
      this.prisma.sale.aggregate({ _sum: { totalAmount: true }, where: todayWhere }),
      this.prisma.sale.count({ where: todayWhere }),
      this.prisma.sale.aggregate({
        _sum: { totalAmount: true },
        where: { soldAt: { gte: startOfMonth } },
      }),
      this.prisma.sale.count({ where: { ...todayWhere, verifiedAt: null } }),
    ]);

    return {
      todayTotal: today._sum.totalAmount ?? 0,
      todayCount,
      monthTotal: month._sum.totalAmount ?? 0,
      unverifiedToday,
    };
  }

  async daySummary(date: string) {
    const { start, next, key } = this.dayRange(date);
    const where = { soldAt: { gte: start, lt: next } };
    const [summary, verifiedCount, latestVerification] = await Promise.all([
      this.prisma.sale.aggregate({
        _count: { _all: true },
        _sum: { totalAmount: true, logisticsFee: true },
        where,
      }),
      this.prisma.sale.count({ where: { ...where, verifiedAt: { not: null } } }),
      this.prisma.sale.findFirst({
        where: { ...where, verifiedAt: { not: null } },
        orderBy: { verifiedAt: 'desc' },
        select: {
          proofUrl: true,
          verifiedAt: true,
          verifiedBy: { select: { name: true } },
        },
      }),
    ]);
    const count = summary._count._all;

    return {
      date: key,
      count,
      totalAmount: summary._sum.totalAmount ?? 0,
      logisticsTotal: summary._sum.logisticsFee ?? 0,
      verifiedCount,
      unverifiedCount: count - verifiedCount,
      proofUrl: latestVerification?.proofUrl ?? null,
      verifiedByName: latestVerification?.verifiedBy?.name ?? null,
      verifiedAt: latestVerification?.verifiedAt ?? null,
    };
  }

  async create(dto: CreateSaleDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const customer = dto.customerId
        ? await tx.customer.findUnique({ where: { id: dto.customerId } })
        : null;
      if (dto.customerId && !customer) throw new NotFoundException('Customer not found');

      const soldAt = dto.soldAt ?? new Date();
      const buyer = customer?.name ?? dto.customerName?.trim() ?? null;
      const lines: {
        productId: string;
        variantId: string;
        productName: string;
        variantName: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        inventoryMovementId: string;
      }[] = [];
      let firstSubsidiaryId: string | null = null;

      for (const item of dto.items) {
        // Resolving here (rather than batching up front) keeps the read inside
        // the transaction and next to the claim it guards.
        const resolved = await resolveStock(tx, item.productId, item.variantId);
        const { product, variant } = resolved;
        firstSubsidiaryId ??= product.subsidiaryId;

        // Conditional decrement — the row is only claimed if the stock is still
        // there, so two concurrent sales can never oversell the same product.
        // For POOLED products this draws quantity × packSize from the pool.
        await claimStock(tx, resolved, item.quantity);

        const movement = await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            type: 'OUT',
            quantity: item.quantity,
            reference: 'SALE',
            note: `Sale${buyer ? ` to ${buyer}` : ''}`,
            occurredAt: soldAt,
            createdById: userId,
          },
        });

        const unitPrice = item.unitPrice ?? effectiveUnitPrice(resolved);
        lines.push({
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          variantName: variant.name,
          unit: product.unit,
          quantity: item.quantity,
          unitPrice,
          lineTotal: item.quantity * unitPrice,
          inventoryMovementId: movement.id,
        });
      }

      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const logisticsFee = dto.logisticsFee ?? 0;

      return tx.sale.create({
        data: {
          subsidiaryId: dto.subsidiaryId ?? customer?.subsidiaryId ?? firstSubsidiaryId,
          customerId: customer?.id ?? null,
          customerName: buyer,
          subtotal,
          logisticsFee,
          totalAmount: subtotal + logisticsFee,
          channel: dto.channel,
          note: dto.note ?? null,
          soldAt,
          createdById: userId,
          items: { create: lines },
        },
        include,
      });
    });
  }

  async verifyDay(dto: VerifySalesDayDto, userId: string) {
    const { start, next } = this.dayRange(dto.date);
    const result = await this.prisma.sale.updateMany({
      where: { soldAt: { gte: start, lt: next }, verifiedAt: null },
      data: {
        verifiedAt: new Date(),
        verifiedById: userId,
        ...(dto.proofUrl !== undefined ? { proofUrl: dto.proofUrl } : {}),
      },
    });
    return { verified: result.count };
  }

  async remove(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      select: {
        verifiedAt: true,
        items: {
          select: {
            productId: true,
            variantId: true,
            quantity: true,
            inventoryMovementId: true,
          },
        },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.verifiedAt) throw new BadRequestException('Verified sales cannot be deleted');

    await this.prisma.$transaction(async (tx) => {
      // Deleting the sale cascades to its items, which frees their movements.
      const deleted = await tx.sale.deleteMany({ where: { id, verifiedAt: null } });
      if (deleted.count === 0) {
        throw new BadRequestException('Verified sales cannot be deleted');
      }

      for (const item of sale.items) {
        // productId is null only when the product was deleted outright, in
        // which case there is no stock left to give back.
        if (item.productId) {
          const resolved = await resolveStock(tx, item.productId, item.variantId);
          await releaseStock(tx, resolved, item.quantity);
        }
        if (item.inventoryMovementId) {
          await tx.inventoryMovement.delete({ where: { id: item.inventoryMovementId } });
        }
      }
    });
    return { ok: true };
  }

  private filterDate(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return this.dayRange(value).start;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
    return date;
  }

  private toFilter(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { lt: this.dayRange(value).next };
    }
    return { lte: this.filterDate(value) };
  }

  private dayRange(value: string | Date) {
    const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : value;
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const key = [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, '0'),
      String(start.getDate()).padStart(2, '0'),
    ].join('-');
    return { start, next, key };
  }
}
