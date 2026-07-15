import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createStaffSchema, updateStaffSchema, type CreateStaffDto, type UpdateStaffDto } from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StaffService } from './staff.service';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @RequirePermissions('staff:read')
  list(@Query('department') department?: string, @Query('subsidiaryId') subsidiaryId?: string) {
    return this.staff.list(department, subsidiaryId);
  }

  @Get(':id')
  @RequirePermissions('staff:read')
  get(@Param('id') id: string) {
    return this.staff.get(id);
  }

  @Post()
  @RequirePermissions('staff:create')
  create(@Body(new ZodValidationPipe(createStaffSchema)) dto: CreateStaffDto) {
    return this.staff.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('staff:update')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateStaffSchema)) dto: UpdateStaffDto) {
    return this.staff.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('staff:delete')
  remove(@Param('id') id: string) {
    return this.staff.remove(id);
  }
}
