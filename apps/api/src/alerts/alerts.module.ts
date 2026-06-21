import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsGeneratorService } from './alerts-generator.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertsGeneratorService],
})
export class AlertsModule {}
