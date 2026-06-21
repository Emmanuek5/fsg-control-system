import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserDto,
  type UpdateUserDto,
} from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  list() {
    return this.users.list();
  }

  @Get(':id')
  @RequirePermissions('users:read')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post()
  @RequirePermissions('users:create')
  create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
