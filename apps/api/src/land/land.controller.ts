import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createLandPaymentSchema,
  createLandPlotSchema,
  updateLandPlotSchema,
  type CreateLandPaymentDto,
  type CreateLandPlotDto,
  type UpdateLandPlotDto,
} from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LandService } from './land.service';

@ApiTags('land')
@ApiBearerAuth()
@Controller('land')
export class LandController {
  constructor(private readonly land: LandService) {}

  @Get('plots')
  @RequirePermissions('land:read')
  listPlots() {
    return this.land.listPlots();
  }

  @Get('plots/:id')
  @RequirePermissions('land:read')
  getPlot(@Param('id') id: string) {
    return this.land.getPlot(id);
  }

  @Post('plots')
  @RequirePermissions('land:create')
  createPlot(@Body(new ZodValidationPipe(createLandPlotSchema)) dto: CreateLandPlotDto) {
    return this.land.createPlot(dto);
  }

  @Patch('plots/:id')
  @RequirePermissions('land:update')
  updatePlot(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLandPlotSchema)) dto: UpdateLandPlotDto,
  ) {
    return this.land.updatePlot(id, dto);
  }

  @Delete('plots/:id')
  @RequirePermissions('land:delete')
  removePlot(@Param('id') id: string) {
    return this.land.removePlot(id);
  }

  @Get('plots/:id/payments')
  @RequirePermissions('land:read')
  listPayments(@Param('id') id: string) {
    return this.land.listPayments(id);
  }

  @Post('payments')
  @RequirePermissions('land:create')
  createPayment(@Body(new ZodValidationPipe(createLandPaymentSchema)) dto: CreateLandPaymentDto) {
    return this.land.createPayment(dto);
  }
}
