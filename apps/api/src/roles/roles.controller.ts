import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createRoleSchema,
  setRolePermissionsSchema,
  updateRoleSchema,
  type CreateRoleDto,
  type SetRolePermissionsDto,
  type UpdateRoleDto,
} from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('permissions')
  @RequirePermissions('roles:read')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Get('roles')
  @RequirePermissions('roles:read')
  list() {
    return this.roles.list();
  }

  @Get('roles/:id')
  @RequirePermissions('roles:read')
  get(@Param('id') id: string) {
    return this.roles.get(id);
  }

  @Post('roles')
  @RequirePermissions('roles:manage')
  create(@Body(new ZodValidationPipe(createRoleSchema)) dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch('roles/:id')
  @RequirePermissions('roles:manage')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) dto: UpdateRoleDto,
  ) {
    return this.roles.update(id, dto);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('roles:manage')
  setPermissions(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setRolePermissionsSchema)) dto: SetRolePermissionsDto,
  ) {
    return this.roles.setPermissions(id, dto.permissionKeys);
  }

  @Delete('roles/:id')
  @RequirePermissions('roles:manage')
  remove(@Param('id') id: string) {
    return this.roles.remove(id);
  }
}
