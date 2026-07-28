import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createSaleSchema,
  verifySalesDaySchema,
  type CreateSaleDto,
  type VerifySalesDayDto,
} from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @RequirePermissions('sales:read')
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('channel') channel?: string,
    @Query('productId') productId?: string,
    @Query('customerId') customerId?: string,
    @Query('subsidiaryId') subsidiaryId?: string,
    @Query('verified') verified?: string,
  ) {
    return this.sales.list({ from, to, channel, productId, customerId, subsidiaryId, verified });
  }

  @Get('summary')
  @RequirePermissions('sales:read')
  summary() {
    return this.sales.summary();
  }

  @Get('day-summary')
  @RequirePermissions('sales:approve')
  daySummary(@Query('date') date: string) {
    return this.sales.daySummary(date);
  }

  @Post()
  @RequirePermissions('sales:create')
  create(
    @Body(new ZodValidationPipe(createSaleSchema)) dto: CreateSaleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sales.create(dto, user.id);
  }

  @Post('verify-day')
  @RequirePermissions('sales:approve')
  verifyDay(
    @Body(new ZodValidationPipe(verifySalesDaySchema)) dto: VerifySalesDayDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sales.verifyDay(dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('sales:delete')
  remove(@Param('id') id: string) {
    return this.sales.remove(id);
  }
}
