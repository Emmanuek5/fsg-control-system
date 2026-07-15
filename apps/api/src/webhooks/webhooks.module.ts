import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MonnifyModule } from '../monnify/monnify.module';
import { NombaWebhooksService } from './nomba-webhooks.service';
import { MonnifyWebhooksService } from './monnify-webhooks.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [PrismaModule, MonnifyModule, NotificationsModule],
  controllers: [WebhooksController],
  providers: [NombaWebhooksService, MonnifyWebhooksService],
})
export class WebhooksModule {}

