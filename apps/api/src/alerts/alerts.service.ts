import { Injectable } from '@nestjs/common';
import type { AlertType } from '@prisma/client';
import type { UpdateAlertDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import type { RequestUser } from '../common/current-user.decorator';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Alert types whose generated messages embed financial figures are only
   * shown to users who can read the underlying module (the generator writes
   * amounts like "₦10,000,000 remaining" into the message text).
   */
  async hiddenAlertTypes(roleId: string | null | undefined): Promise<AlertType[]> {
    const granted = roleId ? await this.permissions.getRolePermissions(roleId) : [];
    const hidden: AlertType[] = [];
    if (!granted.includes('land:read')) hidden.push('LAND_PAYMENT_DUE');
    if (!granted.includes('investments:read')) hidden.push('INVESTMENT_MATURITY');
    return hidden;
  }

  async list(user: RequestUser, status?: string) {
    const hidden = await this.hiddenAlertTypes(user.roleId);
    const where = {
      ...(status === 'resolved' ? { isResolved: true } : status === 'active' ? { isResolved: false } : {}),
      ...(hidden.length ? { type: { notIn: hidden } } : {}),
    };
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
