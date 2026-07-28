import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerDto,
  type UpdateCustomerDto,
} from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customers:read')
  list(@Query('search') search?: string) {
    return this.customers.list(search);
  }

  @Get(':id')
  @RequirePermissions('customers:read')
  get(@Param('id') id: string) {
    return this.customers.get(id);
  }

  @Post()
  @RequirePermissions('customers:create')
  create(
    @Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomerDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.customers.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('customers:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    return this.customers.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('customers:delete')
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }
}
