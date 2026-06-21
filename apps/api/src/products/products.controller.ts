import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductDto,
  type UpdateProductDto,
} from '@fsg/shared';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions('products:read')
  list(@Query('search') search?: string) {
    return this.products.list(search);
  }

  @Get(':id')
  @RequirePermissions('products:read')
  get(@Param('id') id: string) {
    return this.products.get(id);
  }

  @Post()
  @RequirePermissions('products:create')
  create(@Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('products:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('products:delete')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }
}
