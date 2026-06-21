import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { CreateUserDto, UpdateUserDto } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';

const userSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  subsidiaryId: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
  subsidiary: { select: { id: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: userSelect });
  }

  get(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: userSelect });
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        roleId: dto.roleId,
        subsidiaryId: dto.subsidiaryId ?? null,
      },
      select: userSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = {
      name: dto.name,
      email: dto.email,
      roleId: dto.roleId,
      subsidiaryId: dto.subsidiaryId,
      isActive: dto.isActive,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }

  async remove(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
