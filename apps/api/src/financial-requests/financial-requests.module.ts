import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MonnifyModule } from '../monnify/monnify.module';
import { FinancialRequestsController } from './financial-requests.controller';
import { FinancialRequestsService } from './financial-requests.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, MonnifyModule],
  controllers: [FinancialRequestsController],
  providers: [FinancialRequestsService],
})
export class FinancialRequestsModule {}

