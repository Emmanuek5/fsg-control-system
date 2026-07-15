import { Injectable } from '@nestjs/common';
import type { CreateExpenseDto, UpdateExpenseDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: RequestUser, subsidiaryId?: string, category?: string) {
    // Without company-wide financial visibility, users only see their own entries.
    const seesAll = await this.permissions.roleHas(user.roleId, 'finance:read');
    return this.prisma.expense.findMany({
      where: {
        ...(subsidiaryId ? { subsidiaryId } : {}),
        ...(category ? { category } : {}),
        ...(seesAll ? {} : { createdById: user.id }),
      },
      orderBy: { incurredAt: 'desc' },
      take: 500,
      include: {
        subsidiary: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async summary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [all, month, byCategory, byZone, subs] = await Promise.all([
      this.prisma.expense.aggregate({ _sum: { amount: true } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { incurredAt: { gte: startOfMonth } } }),
      this.prisma.expense.groupBy({ by: ['category'], _sum: { amount: true } }),
      this.prisma.expense.groupBy({ by: ['subsidiaryId'], _sum: { amount: true } }),
      this.prisma.subsidiary.findMany({ select: { id: true, name: true } }),
    ]);

    const zoneName = new Map(subs.map((s) => [s.id, s.name]));

    return {
      total: all._sum.amount ?? 0,
      thisMonth: month._sum.amount ?? 0,
      byCategory: byCategory
        .map((c) => ({ category: c.category, total: c._sum.amount ?? 0 }))
        .sort((a, b) => b.total - a.total),
      byZone: byZone
        .map((z) => ({
          zone: z.subsidiaryId ? (zoneName.get(z.subsidiaryId) ?? 'Unknown') : 'General',
          total: z._sum.amount ?? 0,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  create(dto: CreateExpenseDto, userId: string | null) {
    return this.prisma.expense.create({
      data: {
        subsidiaryId: dto.subsidiaryId ?? null,
        category: dto.category,
        description: dto.description ?? null,
        vendor: dto.vendor ?? null,
        amount: dto.amount,
        incurredAt: dto.incurredAt ?? new Date(),
        receiptUrl: dto.receiptUrl ?? null,
        createdById: userId,
      },
    });
  }

  update(id: string, dto: UpdateExpenseDto) {
    return this.prisma.expense.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.expense.delete({ where: { id } });
    return { ok: true };
  }
}
