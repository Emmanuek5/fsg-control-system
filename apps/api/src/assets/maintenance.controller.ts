import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createMaintenanceSchema,
  updateMaintenanceSchema,
  type CreateMaintenanceDto,
  type UpdateMaintenanceDto,
} from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @RequirePermissions('maintenance:read')
  list(@CurrentUser() user: RequestUser, @Query('assetId') assetId?: string) {
    return this.maintenance.list(user, assetId);
  }

  @Post()
  @RequirePermissions('maintenance:create')
  create(@Body(new ZodValidationPipe(createMaintenanceSchema)) dto: CreateMaintenanceDto) {
    return this.maintenance.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('maintenance:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMaintenanceSchema)) dto: UpdateMaintenanceDto,
  ) {
    return this.maintenance.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('maintenance:delete')
  remove(@Param('id') id: string) {
    return this.maintenance.remove(id);
  }
}
