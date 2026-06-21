import { Injectable } from '@nestjs/common';
import type { CreateInvestmentDto, UpdateInvestmentDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const items = await this.prisma.investment.findMany({ orderBy: { maturityDate: 'asc' } });
    return items.map((i) => ({
      ...i,
      nearingMaturity:
        i.status === 'ACTIVE' && i.maturityDate != null && i.maturityDate >= now && i.maturityDate <= in30,
    }));
  }

  create(dto: CreateInvestmentDto) {
    return this.prisma.investment.create({ data: dto });
  }

  update(id: string, dto: UpdateInvestmentDto) {
    return this.prisma.investment.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.investment.delete({ where: { id } });
    return { ok: true };
  }
}
