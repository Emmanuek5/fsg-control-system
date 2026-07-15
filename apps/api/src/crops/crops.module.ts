import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CropsController } from './crops.controller';
import { CropsService } from './crops.service';

@Module({
  imports: [AuthModule],
  controllers: [CropsController],
  providers: [CropsService],
})
export class CropsModule {}
