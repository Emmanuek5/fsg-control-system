import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FarmController } from './farm.controller';
import { FarmService } from './farm.service';

@Module({
  imports: [AuthModule],
  controllers: [FarmController],
  providers: [FarmService],
})
export class FarmModule {}
