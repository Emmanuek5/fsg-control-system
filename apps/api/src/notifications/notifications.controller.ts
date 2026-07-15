import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { updateNotificationSchema, type UpdateNotificationDto } from '@fsg/shared';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications:read')
  list(@CurrentUser() user: RequestUser, @Query('unreadOnly') unreadOnly?: string) {
    return this.notifications.list(user.id, unreadOnly === 'true');
  }

  @Get('unread-count')
  @RequirePermissions('notifications:read')
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user.id).then((count) => ({ count }));
  }

  @Patch(':id')
  @RequirePermissions('notifications:update')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateNotificationSchema)) dto: UpdateNotificationDto,
  ) {
    return this.notifications.update(id, user.id, dto);
  }

  @Post('mark-all-read')
  @RequirePermissions('notifications:update')
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user.id);
  }
}
