import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LivestockController } from './livestock.controller';
import { LivestockService } from './livestock.service';

@Module({
  imports: [AuthModule],
  controllers: [LivestockController],
  providers: [LivestockService],
})
export class LivestockModule {}
