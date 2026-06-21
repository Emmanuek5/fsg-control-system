import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createSubsidiarySchema, type CreateSubsidiaryDto } from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SubsidiariesService } from './subsidiaries.service';

@ApiTags('subsidiaries')
@ApiBearerAuth()
@Controller('subsidiaries')
export class SubsidiariesController {
  constructor(private readonly subsidiaries: SubsidiariesService) {}

  @Get()
  @RequirePermissions('subsidiaries:read')
  list() {
    return this.subsidiaries.list();
  }

  @Post()
  @RequirePermissions('subsidiaries:create')
  create(@Body(new ZodValidationPipe(createSubsidiarySchema)) dto: CreateSubsidiaryDto) {
    return this.subsidiaries.create(dto);
  }
}
