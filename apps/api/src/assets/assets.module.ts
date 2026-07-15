import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [AuthModule],
  controllers: [AssetsController, MaintenanceController],
  providers: [AssetsService, MaintenanceService],
})
export class AssetsModule {}
