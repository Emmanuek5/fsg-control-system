import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsGeneratorService } from './alerts-generator.service';

@Module({
  imports: [AuthModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsGeneratorService],
  exports: [AlertsService],
})
export class AlertsModule {}
