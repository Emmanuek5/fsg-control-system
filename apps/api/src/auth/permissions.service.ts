import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves a user's effective permission keys from their role.
 * Role → permission lookups are cached and invalidated whenever a role's
 * permissions change (see RolesService), so edits take effect immediately
 * without users needing to re-login.
 */
@Injectable()
export class PermissionsService {
  private roleCache = new Map<string, string[]>();

  constructor(private readonly prisma: PrismaService) {}

  async getRolePermissions(roleId: string): Promise<string[]> {
    const cached = this.roleCache.get(roleId);
    if (cached) return cached;

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { key: true } } },
    });
    const keys = rows.map((r) => r.permission.key);
    this.roleCache.set(roleId, keys);
    return keys;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });
    if (!user?.roleId) return [];
    return this.getRolePermissions(user.roleId);
  }

  /** Clear cached permissions for a role (or all roles). */
  invalidate(roleId?: string): void {
    if (roleId) this.roleCache.delete(roleId);
    else this.roleCache.clear();
  }
}
