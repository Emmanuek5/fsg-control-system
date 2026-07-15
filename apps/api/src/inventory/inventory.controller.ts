import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createMovementSchema, type CreateMovementDto } from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory-movements')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions('inventory:read')
  list(@CurrentUser() user: RequestUser, @Query('productId') productId?: string) {
    return this.inventory.list(user, productId);
  }

  @Post()
  @RequirePermissions('inventory:create')
  create(
    @Body(new ZodValidationPipe(createMovementSchema)) dto: CreateMovementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventory.create(dto, user?.id ?? null);
  }
}
