import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createProductSchema,
  createProductVariantSchema,
  updateProductSchema,
  updateProductVariantSchema,
  type CreateProductDto,
  type CreateProductVariantDto,
  type UpdateProductDto,
  type UpdateProductVariantDto,
} from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
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
  list(@CurrentUser() user: RequestUser, @Query('search') search?: string) {
    return this.products.list(user, search);
  }

  @Get(':id')
  @RequirePermissions('products:read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.products.get(user, id);
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

  // ─── Variants ─────────────────────────────────────────────────────────────
  // Nested under the product: a variant has no meaning on its own, and the
  // parent is what carries the stock mode that governs it.

  @Post(':id/variants')
  @RequirePermissions('products:create')
  addVariant(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createProductVariantSchema)) dto: CreateProductVariantDto,
  ) {
    return this.products.addVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  @RequirePermissions('products:update')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body(new ZodValidationPipe(updateProductVariantSchema)) dto: UpdateProductVariantDto,
  ) {
    return this.products.updateVariant(id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @RequirePermissions('products:delete')
  removeVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.products.removeVariant(id, variantId);
  }
}
