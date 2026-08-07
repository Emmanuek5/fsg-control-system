import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createEggProductionSchema,
  createFarmBatchSchema,
  createFarmDispatchSchema,
  createFeedSchema,
  createMortalitySchema,
  updateFarmBatchSchema,
  type BatchType,
  type CreateEggProductionDto,
  type CreateFarmBatchDto,
  type CreateFarmDispatchDto,
  type CreateFeedDto,
  type CreateMortalityDto,
  type UpdateFarmBatchDto,
} from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FarmService } from './farm.service';

@ApiTags('farm')
@ApiBearerAuth()
@Controller('farm')
export class FarmController {
  constructor(private readonly farm: FarmService) {}

  @Get('batches')
  @RequirePermissions('farm:read')
  listBatches(@Query('type') type?: BatchType) {
    return this.farm.listBatches(type);
  }

  @Get('batches/:id')
  @RequirePermissions('farm:read')
  getBatch(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.farm.getBatch(user, id);
  }

  @Post('batches')
  @RequirePermissions('farm:create')
  createBatch(@Body(new ZodValidationPipe(createFarmBatchSchema)) dto: CreateFarmBatchDto) {
    return this.farm.createBatch(dto);
  }

  @Patch('batches/:id')
  @RequirePermissions('farm:update')
  updateBatch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFarmBatchSchema)) dto: UpdateFarmBatchDto,
  ) {
    return this.farm.updateBatch(id, dto);
  }

  @Delete('batches/:id')
  @RequirePermissions('farm:delete')
  removeBatch(@Param('id') id: string) {
    return this.farm.removeBatch(id);
  }

  @Get('batches/:id/eggs')
  @RequirePermissions('farm:read')
  listEggs(@Param('id') id: string) {
    return this.farm.listEggs(id);
  }

  @Post('eggs')
  @RequirePermissions('farm:create')
  createEgg(@Body(new ZodValidationPipe(createEggProductionSchema)) dto: CreateEggProductionDto) {
    return this.farm.createEgg(dto);
  }

  @Get('batches/:id/mortality')
  @RequirePermissions('farm:read')
  listMortality(@Param('id') id: string) {
    return this.farm.listMortality(id);
  }

  @Post('mortality')
  @RequirePermissions('farm:create')
  createMortality(@Body(new ZodValidationPipe(createMortalitySchema)) dto: CreateMortalityDto) {
    return this.farm.createMortality(dto);
  }

  @Get('batches/:id/feed')
  @RequirePermissions('farm:read')
  listFeed(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.farm.listFeed(user, id);
  }

  @Post('feed')
  @RequirePermissions('farm:create')
  createFeed(@Body(new ZodValidationPipe(createFeedSchema)) dto: CreateFeedDto) {
    return this.farm.createFeed(dto);
  }

  @Get('batches/:id/dispatches')
  @RequirePermissions('farm:read')
  listDispatches(@Param('id') id: string) {
    return this.farm.listDispatches(id);
  }

  @Post('dispatch')
  @RequirePermissions('farm:create')
  createDispatch(
    @Body(new ZodValidationPipe(createFarmDispatchSchema)) dto: CreateFarmDispatchDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.farm.createDispatch(dto, user);
  }
}
