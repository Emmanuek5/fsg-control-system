import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthUser, LoginResponse } from '@fsg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';

interface TokenSubject {
  id: string;
  email: string;
  roleId: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  private signAccess(user: TokenSubject): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, roleId: user.roleId },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as any,
      },
    );
  }

  signRefresh(userId: string): string {
    return this.jwt.sign(
      { sub: userId },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_TTL ?? '7d') as any,
      },
    );
  }

  verifyRefresh(token: string): { sub: string } {
    return this.jwt.verify(token, { secret: process.env.JWT_REFRESH_SECRET });
  }

  async buildAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { role: true },
    });
    const permissions = await this.permissions.getUserPermissions(userId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role ? { id: user.role.id, name: user.role.name } : { id: '', name: 'No role' },
      subsidiaryId: user.subsidiaryId,
      permissions,
    };
  }

  async login(email: string, password: string): Promise<{ response: LoginResponse; refreshToken: string }> {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    const accessToken = this.signAccess(user);
    const refreshToken = this.signRefresh(user.id);
    const authUser = await this.buildAuthUser(user.id);
    return { response: { accessToken, user: authUser }, refreshToken };
  }

  async refresh(userId: string): Promise<{ response: LoginResponse; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    const accessToken = this.signAccess(user);
    const refreshToken = this.signRefresh(user.id);
    const authUser = await this.buildAuthUser(user.id);
    return { response: { accessToken, user: authUser }, refreshToken };
  }
}
