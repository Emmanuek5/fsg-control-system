import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createLivestockSchema,
  updateLivestockSchema,
  type CreateLivestockDto,
  type UpdateLivestockDto,
} from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LivestockService } from './livestock.service';

@ApiTags('livestock')
@ApiBearerAuth()
@Controller('livestock')
export class LivestockController {
  constructor(private readonly livestock: LivestockService) {}

  @Get()
  @RequirePermissions('livestock:read')
  list(@CurrentUser() user: RequestUser) {
    return this.livestock.list(user);
  }

  @Post()
  @RequirePermissions('livestock:create')
  create(@Body(new ZodValidationPipe(createLivestockSchema)) dto: CreateLivestockDto) {
    return this.livestock.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('livestock:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLivestockSchema)) dto: UpdateLivestockDto,
  ) {
    return this.livestock.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('livestock:delete')
  remove(@Param('id') id: string) {
    return this.livestock.remove(id);
  }
}
