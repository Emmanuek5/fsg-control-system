import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockRequestsController } from './stock-requests.controller';
import { StockRequestsService } from './stock-requests.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [StockRequestsController],
  providers: [StockRequestsService],
})
export class StockRequestsModule {}
