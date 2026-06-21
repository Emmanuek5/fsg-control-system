import { Injectable } from '@nestjs/common';
import type { CreateLandPaymentDto, CreateLandPlotDto, UpdateLandPlotDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LandService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlots() {
    const plots = await this.prisma.landPlot.findMany({
      orderBy: { createdAt: 'desc' },
      include: { payments: { select: { amount: true } } },
    });
    return plots.map(({ payments, ...p }) => {
      const paidTotal = payments.reduce((s, x) => s + x.amount, 0);
      return { ...p, paidTotal, balance: Math.max(0, p.totalDue - paidTotal) };
    });
  }

  async getPlot(id: string) {
    const plot = await this.prisma.landPlot.findUniqueOrThrow({
      where: { id },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
    const paidTotal = plot.payments.reduce((s, x) => s + x.amount, 0);
    return { ...plot, paidTotal, balance: Math.max(0, plot.totalDue - paidTotal) };
  }

  createPlot(dto: CreateLandPlotDto) {
    return this.prisma.landPlot.create({ data: dto });
  }

  updatePlot(id: string, dto: UpdateLandPlotDto) {
    return this.prisma.landPlot.update({ where: { id }, data: dto });
  }

  async removePlot(id: string) {
    await this.prisma.landPlot.delete({ where: { id } });
    return { ok: true };
  }

  listPayments(plotId: string) {
    return this.prisma.landPayment.findMany({ where: { plotId }, orderBy: { paidAt: 'desc' } });
  }

  createPayment(dto: CreateLandPaymentDto) {
    return this.prisma.landPayment.create({ data: dto });
  }
}
