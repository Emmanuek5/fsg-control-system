import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { approvalDecisionSchema, createRequestCommentSchema, createStockRequestSchema, updateStockRequestSchema, type ApprovalDecisionDto, type CreateRequestCommentDto, type CreateStockRequestDto, type UpdateStockRequestDto } from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StockRequestsService } from './stock-requests.service';

@ApiTags('stock-requests')
@ApiBearerAuth()
@Controller('stock-requests')
export class StockRequestsController {
  constructor(private readonly stockRequests: StockRequestsService) {}

  @Get()
  @RequirePermissions('stock_requests:read')
  list(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.stockRequests.list(user, status);
  }

  @Get(':id')
  @RequirePermissions('stock_requests:read')
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.stockRequests.get(id, user);
  }

  @Post()
  @RequirePermissions('stock_requests:create')
  create(@Body(new ZodValidationPipe(createStockRequestSchema)) dto: CreateStockRequestDto, @CurrentUser() user: RequestUser) {
    return this.stockRequests.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('stock_requests:create')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateStockRequestSchema)) dto: UpdateStockRequestDto, @CurrentUser() user: RequestUser) {
    return this.stockRequests.update(id, dto, user);
  }

  @Post(':id/approve')
  @RequirePermissions('stock_requests:approve')
  approve(@Param('id') id: string, @Body(new ZodValidationPipe(approvalDecisionSchema)) dto: ApprovalDecisionDto, @CurrentUser() user: RequestUser) {
    return this.stockRequests.approve(id, dto, user);
  }

  @Post(':id/deny')
  @RequirePermissions('stock_requests:approve')
  deny(@Param('id') id: string, @Body(new ZodValidationPipe(approvalDecisionSchema)) dto: ApprovalDecisionDto, @CurrentUser() user: RequestUser) {
    return this.stockRequests.deny(id, dto, user);
  }

  @Post(':id/request-info')
  @RequirePermissions('stock_requests:approve')
  requestInfo(@Param('id') id: string, @Body(new ZodValidationPipe(approvalDecisionSchema)) dto: ApprovalDecisionDto, @CurrentUser() user: RequestUser) {
    return this.stockRequests.requestInfo(id, dto, user);
  }

  @Post(':id/comments')
  @RequirePermissions('stock_requests:read')
  addComment(@Param('id') id: string, @Body(new ZodValidationPipe(createRequestCommentSchema.omit({ entityType: true, entityId: true }))) dto: Omit<CreateRequestCommentDto, 'entityType' | 'entityId'>, @CurrentUser() user: RequestUser) {
    return this.stockRequests.addComment(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('stock_requests:delete')
  remove(@Param('id') id: string) {
    return this.stockRequests.remove(id);
  }
}
