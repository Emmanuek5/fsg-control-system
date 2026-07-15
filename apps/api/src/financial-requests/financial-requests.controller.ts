import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { approvalDecisionSchema, createFinancialRequestSchema, createRequestCommentSchema, payOtpSchema, updateFinancialRequestSchema, type ApprovalDecisionDto, type CreateFinancialRequestDto, type CreateRequestCommentDto, type PayOtpDto, type UpdateFinancialRequestDto } from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FinancialRequestsService } from './financial-requests.service';

@ApiTags('financial-requests')
@ApiBearerAuth()
@Controller('financial-requests')
export class FinancialRequestsController {
  constructor(private readonly financialRequests: FinancialRequestsService) {}

  @Get()
  @RequirePermissions('financial_requests:read')
  list(@CurrentUser() user: RequestUser, @Query('status') status?: string, @Query('type') type?: string) {
    return this.financialRequests.list(user, status, type);
  }

  @Get(':id')
  @RequirePermissions('financial_requests:read')
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.financialRequests.get(id, user);
  }

  @Post()
  @RequirePermissions('financial_requests:create')
  create(@Body(new ZodValidationPipe(createFinancialRequestSchema)) dto: CreateFinancialRequestDto, @CurrentUser() user: RequestUser) {
    return this.financialRequests.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('financial_requests:create')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateFinancialRequestSchema)) dto: UpdateFinancialRequestDto, @CurrentUser() user: RequestUser) {
    return this.financialRequests.update(id, dto, user);
  }

  @Post(':id/pay')
  @RequirePermissions('payments:execute')
  pay(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.financialRequests.pay(id, user);
  }

  @Post(':id/pay/validate-otp')
  @RequirePermissions('payments:execute')
  payValidateOtp(@Param('id') id: string, @Body(new ZodValidationPipe(payOtpSchema)) dto: PayOtpDto, @CurrentUser() user: RequestUser) {
    return this.financialRequests.payValidateOtp(id, user, dto);
  }

  @Post(':id/pay/refresh')
  @RequirePermissions('payments:execute')
  payRefresh(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.financialRequests.payRefresh(id, user);
  }
  @Post(':id/approve')
  @RequirePermissions('financial_requests:approve')
  approve(@Param('id') id: string, @Body(new ZodValidationPipe(approvalDecisionSchema)) dto: ApprovalDecisionDto, @CurrentUser() user: RequestUser) {
    return this.financialRequests.approve(id, dto, user);
  }

  @Post(':id/deny')
  @RequirePermissions('financial_requests:approve')
  deny(@Param('id') id: string, @Body(new ZodValidationPipe(approvalDecisionSchema)) dto: ApprovalDecisionDto, @CurrentUser() user: RequestUser) {
    return this.financialRequests.deny(id, dto, user);
  }

  @Post(':id/request-info')
  @RequirePermissions('financial_requests:approve')
  requestInfo(@Param('id') id: string, @Body(new ZodValidationPipe(approvalDecisionSchema)) dto: ApprovalDecisionDto, @CurrentUser() user: RequestUser) {
    return this.financialRequests.requestInfo(id, dto, user);
  }

  @Post(':id/comments')
  @RequirePermissions('financial_requests:read')
  addComment(@Param('id') id: string, @Body(new ZodValidationPipe(createRequestCommentSchema.omit({ entityType: true, entityId: true }))) dto: Omit<CreateRequestCommentDto, 'entityType' | 'entityId'>, @CurrentUser() user: RequestUser) {
    return this.financialRequests.addComment(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('financial_requests:delete')
  remove(@Param('id') id: string) {
    return this.financialRequests.remove(id);
  }
}

