import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createCropInputSchema,
  createCropRotationSchema,
  createCropSchema,
  updateCropSchema,
  type CreateCropDto,
  type CreateCropInputDto,
  type CreateCropRotationDto,
  type UpdateCropDto,
} from '@fsg/shared';
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

  // Sub-resource creates/deletes declared before ':id' patterns of the same shape.
  @Post('inputs')
  @RequirePermissions('crops:create')
  createInput(@Body(new ZodValidationPipe(createCropInputSchema)) dto: CreateCropInputDto) {
    return this.crops.createInput(dto);
  }

  @Delete('inputs/:id')
  @RequirePermissions('crops:delete')
  removeInput(@Param('id') id: string) {
    return this.crops.removeInput(id);
  }

  @Post('rotations')
  @RequirePermissions('crops:create')
  createRotation(@Body(new ZodValidationPipe(createCropRotationSchema)) dto: CreateCropRotationDto) {
    return this.crops.createRotation(dto);
  }

  @Delete('rotations/:id')
  @RequirePermissions('crops:delete')
  removeRotation(@Param('id') id: string) {
    return this.crops.removeRotation(id);
  }

  @Get(':id')
  @RequirePermissions('crops:read')
  get(@Param('id') id: string) {
    return this.crops.get(id);
  }

  @Get(':id/inputs')
  @RequirePermissions('crops:read')
  listInputs(@Param('id') id: string) {
    return this.crops.listInputs(id);
  }

  @Get(':id/rotations')
  @RequirePermissions('crops:read')
  listRotations(@Param('id') id: string) {
    return this.crops.listRotations(id);
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
