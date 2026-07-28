import { Injectable } from '@nestjs/common';
import {
  StockMode,
  type DashboardKpis,
  type EggProductionPoint,
  type RecentActivityItem,
  type SubsidiaryPerformancePoint,
} from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AlertsService } from '../alerts/alerts.service';
import type { RequestUser } from '../common/current-user.decorator';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly alerts: AlertsService,
  ) {}

  async kpis(user: RequestUser): Promise<DashboardKpis> {
    // dashboard:view alone shows operational KPIs; the money figures re-check
    // the underlying visibility permissions so the dashboard can't leak what
    // the modules themselves would deny.
    const granted = user.roleId ? await this.permissions.getRolePermissions(user.roleId) : [];
    const seesFinance = granted.includes('finance:read');
    const seesLand = seesFinance && granted.includes('land:read');
    const seesInvestments = granted.includes('investments:read');
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      products,
      salesToday,
      salesMonth,
      activeBatches,
      eggsWeek,
      overdueMaintenance,
      plots,
      investmentsNearingMaturity,
      activeAlerts,
    ] = await Promise.all([
      this.prisma.product.findMany({
        select: {
          stockMode: true,
          quantityOnHand: true,
          costPrice: true,
          variants: { select: { quantityOnHand: true, costPrice: true } },
        },
      }),
      this.prisma.sale.aggregate({
        _sum: { totalAmount: true },
        where: { soldAt: { gte: startOfDay } },
      }),
      this.prisma.sale.aggregate({
        _sum: { totalAmount: true },
        where: { soldAt: { gte: startOfMonth } },
      }),
      this.prisma.farmBatch.findMany({
        where: { status: 'ACTIVE' },
        select: { initialCount: true, mortalityRecords: { select: { count: true } } },
      }),
      this.prisma.eggProduction.aggregate({
        _sum: { eggsCollected: true },
        where: { date: { gte: weekAgo } },
      }),
      this.prisma.maintenanceLog.count({
        where: { status: 'SCHEDULED', scheduledDate: { lt: now } },
      }),
      this.prisma.landPlot.findMany({
        select: { totalDue: true, payments: { select: { amount: true } } },
      }),
      this.prisma.investment.count({
        where: { status: 'ACTIVE', maturityDate: { gte: now, lte: in30Days } },
      }),
      this.prisma.alert.count({ where: { isResolved: false } }),
    ]);

    // POOLED products are valued off the pool at the product's cost; for
    // PER_VARIANT ones each variant is valued at its own cost, since pack
    // sizes rarely cost the same per unit.
    const totalStockValue = products.reduce((sum, p) => {
      if (p.stockMode === StockMode.POOLED) return sum + p.quantityOnHand * p.costPrice;
      return (
        sum +
        p.variants.reduce((sub, v) => sub + v.quantityOnHand * (v.costPrice || p.costPrice), 0)
      );
    }, 0);
    const birdsAlive = activeBatches.reduce(
      (sum, b) => sum + b.initialCount - b.mortalityRecords.reduce((m, r) => m + r.count, 0),
      0,
    );
    const unpaidLandBalance = plots.reduce((sum, p) => {
      const paid = p.payments.reduce((a, x) => a + x.amount, 0);
      return sum + Math.max(0, p.totalDue - paid);
    }, 0);

    return {
      totalStockValue: seesFinance ? totalStockValue : null,
      salesToday: seesFinance ? (salesToday._sum.totalAmount ?? 0) : null,
      salesThisMonth: seesFinance ? (salesMonth._sum.totalAmount ?? 0) : null,
      birdsAlive,
      eggsThisWeek: eggsWeek._sum.eggsCollected ?? 0,
      overdueMaintenance,
      unpaidLandBalance: seesLand ? unpaidLandBalance : null,
      investmentsNearingMaturity: seesInvestments ? investmentsNearingMaturity : null,
      activeAlerts,
    };
  }

  async subsidiaryPerformance(): Promise<SubsidiaryPerformancePoint[]> {
    const [subs, sales] = await Promise.all([
      this.prisma.subsidiary.findMany({ select: { id: true, name: true, type: true } }),
      this.prisma.sale.groupBy({ by: ['subsidiaryId'], _sum: { totalAmount: true } }),
    ]);
    const revenueBySub = new Map(sales.map((s) => [s.subsidiaryId, s._sum.totalAmount ?? 0]));
    return subs.map((s) => ({
      subsidiary: s.name,
      type: s.type,
      revenue: revenueBySub.get(s.id) ?? 0,
    }));
  }

  async eggTrend(): Promise<EggProductionPoint[]> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.eggProduction.findMany({
      where: { date: { gte: since } },
      select: { date: true, eggsCollected: true },
      orderBy: { date: 'asc' },
    });
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const key = r.date.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + r.eggsCollected);
    }
    return [...byDay.entries()].map(([date, eggs]) => ({ date, eggs }));
  }

  async recentActivity(user: RequestUser): Promise<RecentActivityItem[]> {
    const seesFinance = await this.permissions.roleHas(user.roleId, 'finance:read');
    const [sales, movements] = await Promise.all([
      this.prisma.sale.findMany({
        take: 6,
        orderBy: { soldAt: 'desc' },
        include: {
          items: { select: { productName: true, quantity: true } },
          createdBy: { select: { name: true } },
        },
      }),
      this.prisma.inventoryMovement.findMany({
        take: 6,
        orderBy: { occurredAt: 'desc' },
        include: {
          product: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      }),
    ]);

    const items: RecentActivityItem[] = [
      ...sales.map((s) => ({
        id: `sale-${s.id}`,
        kind: 'sale',
        description: this.describeSale(s.items),
        amount: seesFinance ? s.totalAmount : null,
        occurredAt: s.soldAt.toISOString(),
        actor: s.createdBy?.name ?? null,
      })),
      ...movements.map((m) => ({
        id: `mov-${m.id}`,
        kind: 'movement',
        description: `Stock ${m.type} ${m.quantity} × ${m.product?.name ?? 'item'}`,
        amount: null,
        occurredAt: m.occurredAt.toISOString(),
        actor: m.createdBy?.name ?? null,
      })),
    ];

    return items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8);
  }

  private describeSale(items: { productName: string; quantity: number }[]) {
    const [first, ...rest] = items;
    if (!first) return 'Recorded a sale';
    const line = `Sold ${first.quantity} × ${first.productName}`;
    return rest.length ? `${line} +${rest.length} more` : line;
  }

  async urgentAlerts(user: RequestUser) {
    // Same policy as the alerts page: financial alert types stay hidden from
    // users who can't read the underlying module.
    const hidden = await this.alerts.hiddenAlertTypes(user.roleId);
    return this.prisma.alert.findMany({
      where: { isResolved: false, ...(hidden.length ? { type: { notIn: hidden } } : {}) },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    });
  }
}
