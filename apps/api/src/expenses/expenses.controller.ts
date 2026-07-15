import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createExpenseSchema,
  updateExpenseSchema,
  type CreateExpenseDto,
  type UpdateExpenseDto,
} from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermissions('expenses:read')
  list(
    @CurrentUser() user: RequestUser,
    @Query('subsidiaryId') subsidiaryId?: string,
    @Query('category') category?: string,
  ) {
    return this.expenses.list(user, subsidiaryId, category);
  }

  // Company-wide totals — needs financial visibility on top of plain read access.
  @Get('summary')
  @RequirePermissions('expenses:read', 'finance:read')
  summary() {
    return this.expenses.summary();
  }

  @Post()
  @RequirePermissions('expenses:create')
  create(
    @Body(new ZodValidationPipe(createExpenseSchema)) dto: CreateExpenseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expenses.create(dto, user?.id ?? null);
  }

  @Patch(':id')
  @RequirePermissions('expenses:update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) dto: UpdateExpenseDto,
  ) {
    return this.expenses.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('expenses:delete')
  remove(@Param('id') id: string) {
    return this.expenses.remove(id);
  }
}
