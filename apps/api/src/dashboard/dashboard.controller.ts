import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  @RequirePermissions('dashboard:view')
  kpis(@CurrentUser() user: RequestUser) {
    return this.dashboard.kpis(user);
  }

  // Revenue by subsidiary is company-wide financial data.
  @Get('subsidiary-performance')
  @RequirePermissions('dashboard:view', 'finance:read')
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
  recentActivity(@CurrentUser() user: RequestUser) {
    return this.dashboard.recentActivity(user);
  }

  @Get('urgent-alerts')
  @RequirePermissions('dashboard:view')
  urgentAlerts(@CurrentUser() user: RequestUser) {
    return this.dashboard.urgentAlerts(user);
  }
}
