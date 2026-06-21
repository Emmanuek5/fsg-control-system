import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  @RequirePermissions('dashboard:view')
  kpis() {
    return this.dashboard.kpis();
  }

  @Get('subsidiary-performance')
  @RequirePermissions('dashboard:view')
  subsidiaryPerformance() {
    return this.dashboard.subsidiaryPerformance();
  }

  @Get('egg-trend')
  @RequirePermissions('dashboard:view')
  eggTrend() {
    return this.dashboard.eggTrend();
  }

  @Get('recent-activity')
  @RequirePermissions('dashboard:view')
  recentActivity() {
    return this.dashboard.recentActivity();
  }

  @Get('urgent-alerts')
  @RequirePermissions('dashboard:view')
  urgentAlerts() {
    return this.dashboard.urgentAlerts();
  }
}
