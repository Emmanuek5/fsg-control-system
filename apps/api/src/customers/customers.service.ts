import { BadRequestException, Injectable } from '@nestjs/common';
import type { CreateCustomerDto, UpdateCustomerDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

const include = {
  subsidiary: { select: { id: true, name: true } },
  _count: { select: { sales: true } },
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search?: string) {
    const customers = await this.prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { company: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      include,
    });

    // One grouped query beats N per-customer aggregates on a list this size.
    const totals = await this.prisma.sale.groupBy({
      by: ['customerId'],
      _sum: { totalAmount: true },
      where: { customerId: { in: customers.map((customer) => customer.id) } },
    });
    const spendByCustomer = new Map(
      totals.map((row) => [row.customerId, row._sum.totalAmount ?? 0]),
    );

    return customers.map(({ _count, ...customer }) => ({
      ...customer,
      salesCount: _count.sales,
      totalSpend: spendByCustomer.get(customer.id) ?? 0,
    }));
  }

  async get(id: string) {
    const [customer, spend] = await Promise.all([
      this.prisma.customer.findUniqueOrThrow({
        where: { id },
        include: {
          ...include,
          sales: {
            orderBy: { soldAt: 'desc' },
            take: 20,
            include: {
              items: { select: { id: true, productName: true, quantity: true, unit: true } },
            },
          },
        },
      }),
      this.prisma.sale.aggregate({ _sum: { totalAmount: true }, where: { customerId: id } }),
    ]);
    const { _count, ...rest } = customer;
    return { ...rest, salesCount: _count.sales, totalSpend: spend._sum.totalAmount ?? 0 };
  }

  create(dto: CreateCustomerDto, userId: string) {
    return this.prisma.customer.create({
      data: { ...this.data(dto), name: dto.name, createdById: userId },
    });
  }

  update(id: string, dto: UpdateCustomerDto) {
    return this.prisma.customer.update({ where: { id }, data: this.data(dto) });
  }

  async remove(id: string) {
    const salesCount = await this.prisma.sale.count({ where: { customerId: id } });
    if (salesCount > 0) {
      throw new BadRequestException(
        `This customer has ${salesCount} recorded ${salesCount === 1 ? 'sale' : 'sales'} and cannot be deleted`,
      );
    }
    await this.prisma.customer.delete({ where: { id } });
    return { ok: true };
  }

  /** Blank strings from the form mean "not provided", not an empty value. */
  private data(dto: UpdateCustomerDto) {
    const blankToNull = <T extends string | null | undefined>(value: T) =>
      value === undefined ? undefined : ((value?.trim() || null) as string | null);
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      company: blankToNull(dto.company),
      phone: blankToNull(dto.phone),
      email: blankToNull(dto.email),
      addressLine: blankToNull(dto.addressLine),
      city: blankToNull(dto.city),
      state: blankToNull(dto.state),
      country: blankToNull(dto.country),
      notes: blankToNull(dto.notes),
      ...(dto.subsidiaryId !== undefined ? { subsidiaryId: dto.subsidiaryId || null } : {}),
    };
  }
}
