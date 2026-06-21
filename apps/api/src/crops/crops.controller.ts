import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createCropSchema, updateCropSchema, type CreateCropDto, type UpdateCropDto } from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CropsService } from './crops.service';

@ApiTags('crops')
@ApiBearerAuth()
@Controller('crops')
export class CropsController {
  constructor(private readonly crops: CropsService) {}

  @Get()
  @RequirePermissions('crops:read')
  list() {
    return this.crops.list();
  }

  @Post()
  @RequirePermissions('crops:create')
  create(@Body(new ZodValidationPipe(createCropSchema)) dto: CreateCropDto) {
    return this.crops.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('crops:update')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateCropSchema)) dto: UpdateCropDto) {
    return this.crops.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('crops:delete')
  remove(@Param('id') id: string) {
    return this.crops.remove(id);
  }
}
