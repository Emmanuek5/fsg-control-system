import { Injectable } from '@nestjs/common';
import type { CreateStaffDto, UpdateStaffDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  list(department?: string, subsidiaryId?: string) {
    return this.prisma.staff.findMany({
      where: {
        ...(department ? { department: department as any } : {}),
        ...(subsidiaryId ? { subsidiaryId } : {}),
      },
      orderBy: { name: 'asc' },
      take: 500,
      include: {
        subsidiary: { select: { id: true, name: true } },
        linkedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  get(id: string) {
    return this.prisma.staff.findUniqueOrThrow({
      where: { id },
      include: {
        subsidiary: { select: { id: true, name: true } },
        linkedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  create(dto: CreateStaffDto) {
    return this.prisma.staff.create({
      data: {
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        jobTitle: dto.jobTitle ?? null,
        department: dto.department,
        subsidiaryId: dto.subsidiaryId ?? null,
        status: dto.status ?? 'ACTIVE',
        startDate: dto.startDate ?? null,
        bankName: dto.bankName ?? null,
        bankCode: dto.bankCode ?? null,
        accountNumber: dto.accountNumber ?? null,
        accountName: dto.accountName ?? null,
        linkedUserId: dto.linkedUserId ?? null,
      },
    });
  }

  update(id: string, dto: UpdateStaffDto) {
    return this.prisma.staff.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        jobTitle: dto.jobTitle,
        department: dto.department,
        subsidiaryId: dto.subsidiaryId,
        status: dto.status,
        startDate: dto.startDate,
        bankName: dto.bankName,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        linkedUserId: dto.linkedUserId,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.staff.delete({ where: { id } });
    return { ok: true };
  }
}
