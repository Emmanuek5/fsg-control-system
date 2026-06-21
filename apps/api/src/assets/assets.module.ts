import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  controllers: [AssetsController, MaintenanceController],
  providers: [AssetsService, MaintenanceService],
})
export class AssetsModule {}
