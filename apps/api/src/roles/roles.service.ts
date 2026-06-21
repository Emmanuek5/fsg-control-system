import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ALL_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  PERMISSION_RESOURCES,
  type CreateRoleDto,
  type UpdateRoleDto,
} from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list() {
    const roles = await this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissionKeys: r.permissions.map((p) => p.permission.key),
      createdAt: r.createdAt,
    }));
  }

  async get(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
    });
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissionKeys: role.permissions.map((p) => p.permission.key),
      createdAt: role.createdAt,
    };
  }

  async create(dto: CreateRoleDto) {
    const role = await this.prisma.role.create({
      data: { name: dto.name, description: dto.description ?? null },
    });
    if (dto.permissionKeys?.length) {
      await this.setPermissions(role.id, dto.permissionKeys);
    }
    return this.get(role.id);
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.prisma.role.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
    return this.get(id);
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }
    const userCount = await this.prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new BadRequestException('Reassign users to another role before deleting this one');
    }
    await this.prisma.role.delete({ where: { id } });
    this.permissions.invalidate(id);
    return { ok: true };
  }

  async setPermissions(roleId: string, permissionKeys: string[]) {
    // Keep only keys that exist in the catalog
    const validKeys = permissionKeys.filter((k) => ALL_PERMISSION_KEYS.includes(k));
    const perms = await this.prisma.permission.findMany({
      where: { key: { in: validKeys } },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      }),
    ]);

    this.permissions.invalidate(roleId);
    return this.get(roleId);
  }

  /** The full permission catalog for rendering the matrix. */
  listPermissions() {
    return { resources: PERMISSION_RESOURCES, permissions: ALL_PERMISSIONS };
  }
}
