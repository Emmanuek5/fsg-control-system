import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ALL_PERMISSIONS } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves a user's effective permission keys from their role.
 * Role → permission lookups are cached and invalidated whenever a role's
 * permissions change (see RolesService), so edits take effect immediately
 * without users needing to re-login.
 */
@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);
  private roleCache = new Map<string, string[]>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sync the permissions table with the shared catalog on boot so new
   * permission keys reach existing databases without running the seed (the
   * seed also rebuilds default roles, demo logins and sample data, which must
   * never happen against production). Inserts missing rows only — role
   * grants, users and business data are never touched here.
   */
  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.permission.findMany({ select: { key: true } });
    const known = new Set(existing.map((p) => p.key));
    const missing = ALL_PERMISSIONS.filter((p) => !known.has(p.key));
    if (missing.length === 0) return;
    await this.prisma.permission.createMany({
      data: missing.map((p) => ({
        key: p.key,
        resource: p.resource,
        action: p.action,
        description: p.description,
      })),
      skipDuplicates: true,
    });
    this.logger.log(
      `Added ${missing.length} new permission(s) from catalog: ${missing.map((p) => p.key).join(', ')}`,
    );
  }

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

  /** Whether a role holds a permission key. False for users without a role. */
  async roleHas(roleId: string | null | undefined, key: string): Promise<boolean> {
    if (!roleId) return false;
    const keys = await this.getRolePermissions(roleId);
    return keys.includes(key);
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
