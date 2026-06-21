import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createInvestmentSchema,
  updateInvestmentSchema,
  type CreateInvestmentDto,
  type UpdateInvestmentDto,
} from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InvestmentsService } from './investments.service';

@ApiTags('investments')
@ApiBearerAuth()
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @Get()
  @RequirePermissions('investments:read')
  list() {
    return this.investments.list();
  }

  @Post()
  @RequirePermissions('investments:create')
  create(@Body(new ZodValidationPipe(createInvestmentSchema)) dto: CreateInvestmentDto) {
    return this.investments.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('investments:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInvestmentSchema)) dto: UpdateInvestmentDto,
  ) {
    return this.investments.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('investments:delete')
  remove(@Param('id') id: string) {
    return this.investments.remove(id);
  }
}
