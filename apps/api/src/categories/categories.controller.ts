import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryDto,
  type UpdateCategoryDto,
} from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions('products:read')
  list() {
    return this.categories.list();
  }

  @Post()
  @RequirePermissions('products:create')
  create(@Body(new ZodValidationPipe(createCategorySchema)) dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('products:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('products:delete')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
