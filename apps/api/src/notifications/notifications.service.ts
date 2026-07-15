import { Injectable } from '@nestjs/common';
import type { NotificationType, RequestEntityType, UpdateNotificationDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

interface NotifyInput {
  type?: NotificationType;
  title: string;
  message?: string | null;
  entityType?: RequestEntityType;
  entityId?: string | null;
  href?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  update(id: string, userId: string, dto: UpdateNotificationDto) {
    return this.prisma.notification.update({ where: { id, userId }, data: dto });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { ok: true };
  }

  async notifyUser(userId: string | null | undefined, input: NotifyInput) {
    if (!userId) return null;
    return this.prisma.notification.create({
      data: {
        userId,
        type: input.type ?? 'GENERAL',
        title: input.title,
        message: input.message ?? null,
        entityType: input.entityType ?? 'GENERAL',
        entityId: input.entityId ?? null,
        href: input.href ?? null,
      },
    });
  }

  async notifyUsersWithPermission(permissionKey: string, input: NotifyInput, excludeUserId?: string | null) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        role: { permissions: { some: { permission: { key: permissionKey } } } },
      },
      select: { id: true },
    });
    if (users.length === 0) return { count: 0 };
    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: input.type ?? 'GENERAL',
        title: input.title,
        message: input.message ?? null,
        entityType: input.entityType ?? 'GENERAL',
        entityId: input.entityId ?? null,
        href: input.href ?? null,
      })),
    });
    return { count: users.length };
  }
}
