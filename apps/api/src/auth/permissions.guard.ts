import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../common/require-permissions.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string } | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');

    const granted = await this.permissions.getUserPermissions(user.id);
    const ok = required.every((perm) => granted.includes(perm));
    if (!ok) {
      throw new ForbiddenException(`Missing required permission: ${required.join(', ')}`);
    }
    return true;
  }
}
