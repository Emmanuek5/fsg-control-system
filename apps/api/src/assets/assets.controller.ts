import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createAssetSchema,
  updateAssetSchema,
  type CreateAssetDto,
  type UpdateAssetDto,
} from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AssetsService } from './assets.service';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @RequirePermissions('assets:read')
  list(@CurrentUser() user: RequestUser) {
    return this.assets.list(user);
  }

  @Get(':id')
  @RequirePermissions('assets:read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.assets.getAsset(user, id);
  }

  @Post()
  @RequirePermissions('assets:create')
  create(@Body(new ZodValidationPipe(createAssetSchema)) dto: CreateAssetDto) {
    return this.assets.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('assets:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAssetSchema)) dto: UpdateAssetDto,
  ) {
    return this.assets.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('assets:delete')
  remove(@Param('id') id: string) {
    return this.assets.remove(id);
  }
}
