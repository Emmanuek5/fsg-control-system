import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSaleDto, SaleChannel, VerifySalesDayDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

const include = {
  product: { select: { id: true, name: true, unit: true } },
  subsidiary: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
};

interface SalesFilters {
  from?: string;
  to?: string;
  channel?: string;
  productId?: string;
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
        ...(filters.productId ? { productId: filters.productId } : {}),
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
        _sum: { totalAmount: true },
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
      verifiedCount,
      unverifiedCount: count - verifiedCount,
      proofUrl: latestVerification?.proofUrl ?? null,
      verifiedByName: latestVerification?.verifiedBy?.name ?? null,
      verifiedAt: latestVerification?.verifiedAt ?? null,
    };
  }

  async create(dto: CreateSaleDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found');
      if (product.quantityOnHand < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Only ${product.quantityOnHand} ${product.unit} available`,
        );
      }

      const soldAt = dto.soldAt ?? new Date();
      const unitPrice = dto.unitPrice ?? product.unitPrice;
      const stockClaim = await tx.product.updateMany({
        where: {
          id: product.id,
          quantityOnHand: { gte: dto.quantity },
        },
        data: { quantityOnHand: { decrement: dto.quantity } },
      });
      if (stockClaim.count === 0) {
        const current = await tx.product.findUnique({ where: { id: product.id } });
        throw new BadRequestException(
          `Insufficient stock. Only ${current?.quantityOnHand ?? 0} ${product.unit} available`,
        );
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'OUT',
          quantity: dto.quantity,
          reference: 'SALE',
          note: `Sale${dto.customer ? ` to ${dto.customer}` : ''}`,
          occurredAt: soldAt,
          createdById: userId,
        },
      });
      return tx.sale.create({
        data: {
          subsidiaryId: dto.subsidiaryId ?? product.subsidiaryId,
          productId: product.id,
          quantity: dto.quantity,
          unitPrice,
          totalAmount: dto.quantity * unitPrice,
          channel: dto.channel,
          customer: dto.customer ?? null,
          soldAt,
          createdById: userId,
          inventoryMovementId: movement.id,
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
        productId: true,
        quantity: true,
        verifiedAt: true,
        inventoryMovementId: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.verifiedAt) throw new BadRequestException('Verified sales cannot be deleted');

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.sale.deleteMany({ where: { id, verifiedAt: null } });
      if (deleted.count === 0) {
        throw new BadRequestException('Verified sales cannot be deleted');
      }

      if (sale.productId) {
        await tx.product.update({
          where: { id: sale.productId },
          data: { quantityOnHand: { increment: sale.quantity } },
        });
      }
      if (sale.inventoryMovementId) {
        await tx.inventoryMovement.delete({ where: { id: sale.inventoryMovementId } });
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
