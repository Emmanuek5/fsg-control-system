import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AlertSeverity, AlertType } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

interface Issue {
  sourceKey: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  subsidiaryId?: string | null;
  relatedEntity: string;
}

/**
 * Scans operational data and keeps an up-to-date set of condition-based alerts.
 * Alerts are deduped by `sourceKey` so repeated runs never create duplicates;
 * conditions that clear are auto-resolved. Runs on startup, hourly, and on demand.
 */
@Injectable()
export class AlertsGeneratorService implements OnModuleInit {
  private readonly logger = new Logger('AlertsGenerator');

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Defer slightly so the DB connection and seed are settled; non-blocking.
    setTimeout(() => {
      this.generate().catch((e) => this.logger.error('startup generate failed', e));
    }, 1500);
  }

  @Cron(CronExpression.EVERY_HOUR)
  scheduled() {
    this.generate().catch((e) => this.logger.error('scheduled generate failed', e));
  }

  async generate() {
    const issues = await this.collectIssues();
    const activeKeys = new Set(issues.map((i) => i.sourceKey));

    for (const i of issues) {
      const existing = await this.prisma.alert.findUnique({ where: { sourceKey: i.sourceKey } });
      if (!existing) {
        await this.prisma.alert.create({
          data: {
            type: i.type,
            severity: i.severity,
            title: i.title,
            message: i.message,
            subsidiaryId: i.subsidiaryId ?? null,
            relatedEntity: i.relatedEntity,
            sourceKey: i.sourceKey,
          },
        });
      } else if (!existing.isResolved) {
        // refresh wording/severity while the condition still holds (keep user's read state)
        await this.prisma.alert.update({
          where: { sourceKey: i.sourceKey },
          data: { severity: i.severity, title: i.title, message: i.message },
        });
      }
      // if a resolved auto-alert still matches, leave it acknowledged
    }

    // Auto-clear previously-raised auto alerts whose condition no longer holds.
    // We delete (rather than resolve) so a recurrence raises a fresh alert.
    // Only unresolved ones are touched, so user-acknowledged alerts are left alone.
    const open = await this.prisma.alert.findMany({
      where: { isResolved: false, sourceKey: { not: null } },
      select: { id: true, sourceKey: true },
    });
    let cleared = 0;
    for (const a of open) {
      if (a.sourceKey && !activeKeys.has(a.sourceKey)) {
        await this.prisma.alert.delete({ where: { id: a.id } });
        cleared += 1;
      }
    }

    this.logger.log(`generated alerts: ${issues.length} active condition(s), ${cleared} auto-cleared`);
    return { active: issues.length, cleared };
  }

  private async collectIssues(): Promise<Issue[]> {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const issues: Issue[] = [];
    const money = (n: number) => `₦${Math.round(n).toLocaleString()}`;

    // 1. Low stock
    const products = await this.prisma.product.findMany({
      select: { id: true, name: true, quantityOnHand: true, reorderLevel: true, subsidiaryId: true },
    });
    for (const p of products) {
      if (p.reorderLevel > 0 && p.quantityOnHand <= p.reorderLevel) {
        issues.push({
          sourceKey: `low_stock:${p.id}`,
          type: 'LOW_STOCK',
          severity: p.quantityOnHand === 0 ? 'CRITICAL' : 'WARNING',
          title: `Low stock: ${p.name}`,
          message: `${p.quantityOnHand} in stock (reorder level is ${p.reorderLevel}).`,
          subsidiaryId: p.subsidiaryId,
          relatedEntity: 'product',
        });
      }
    }

    // 2. Overdue maintenance
    const logs = await this.prisma.maintenanceLog.findMany({
      where: { status: 'SCHEDULED', scheduledDate: { lt: now } },
      include: { asset: { select: { name: true, subsidiaryId: true } } },
    });
    for (const l of logs) {
      issues.push({
        sourceKey: `maintenance_due:${l.id}`,
        type: 'MAINTENANCE_DUE',
        severity: 'CRITICAL',
        title: `Overdue maintenance: ${l.asset.name}`,
        message: `${l.type ?? 'Maintenance'} was due ${l.scheduledDate.toISOString().slice(0, 10)}.`,
        subsidiaryId: l.asset.subsidiaryId,
        relatedEntity: 'asset',
      });
    }

    // 3. Outstanding land balances
    const plots = await this.prisma.landPlot.findMany({
      include: { payments: { select: { amount: true } } },
    });
    for (const p of plots) {
      const paid = p.payments.reduce((s, x) => s + x.amount, 0);
      const balance = p.totalDue - paid;
      if (balance > 0) {
        issues.push({
          sourceKey: `land_balance:${p.id}`,
          type: 'LAND_PAYMENT_DUE',
          severity: 'WARNING',
          title: `Outstanding balance: ${p.name}`,
          message: `${money(balance)} remaining of ${money(p.totalDue)}.`,
          relatedEntity: 'land_plot',
        });
      }
    }

    // 4. Investments nearing maturity
    const investments = await this.prisma.investment.findMany({
      where: { status: 'ACTIVE', maturityDate: { gte: now, lte: in30Days } },
    });
    for (const inv of investments) {
      const days = Math.ceil((inv.maturityDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      issues.push({
        sourceKey: `investment_maturity:${inv.id}`,
        type: 'INVESTMENT_MATURITY',
        severity: 'INFO',
        title: `Investment maturing: ${inv.name}`,
        message: `Matures in ${days} day(s) on ${inv.maturityDate!.toISOString().slice(0, 10)}.`,
        relatedEntity: 'investment',
      });
    }

    return issues;
  }
}
