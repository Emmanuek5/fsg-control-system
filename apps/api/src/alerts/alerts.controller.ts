import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { updateAlertSchema, type UpdateAlertDto } from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AlertsService } from './alerts.service';
import { AlertsGeneratorService } from './alerts-generator.service';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly generator: AlertsGeneratorService,
  ) {}

  @Get()
  @RequirePermissions('alerts:read')
  list(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.alerts.list(user, status);
  }

  @Post('generate')
  @RequirePermissions('alerts:update')
  generate() {
    return this.generator.generate();
  }

  @Patch(':id')
  @RequirePermissions('alerts:update')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateAlertSchema)) dto: UpdateAlertDto) {
    return this.alerts.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('alerts:delete')
  remove(@Param('id') id: string) {
    return this.alerts.remove(id);
  }
}
