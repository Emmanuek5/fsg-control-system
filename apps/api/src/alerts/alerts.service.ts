import { Injectable } from '@nestjs/common';
import type { UpdateAlertDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: string) {
    const where =
      status === 'resolved'
        ? { isResolved: true }
        : status === 'active'
          ? { isResolved: false }
          : undefined;
    return this.prisma.alert.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  update(id: string, dto: UpdateAlertDto) {
    return this.prisma.alert.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.alert.delete({ where: { id } });
    return { ok: true };
  }
}
