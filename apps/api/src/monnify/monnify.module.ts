import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MonnifyService } from './monnify.service';
import { MonnifyPaymentsService } from './monnify-payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [MonnifyService, MonnifyPaymentsService],
  exports: [MonnifyService, MonnifyPaymentsService],
})
export class MonnifyModule {}
