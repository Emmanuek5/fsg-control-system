import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { SubsidiariesModule } from './subsidiaries/subsidiaries.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadsModule } from './uploads/uploads.module';
import { FarmModule } from './farm/farm.module';
import { CropsModule } from './crops/crops.module';
import { LivestockModule } from './livestock/livestock.module';
import { AssetsModule } from './assets/assets.module';
import { LandModule } from './land/land.module';
import { InvestmentsModule } from './investments/investments.module';
import { AlertsModule } from './alerts/alerts.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StockRequestsModule } from './stock-requests/stock-requests.module';
import { FinancialRequestsModule } from './financial-requests/financial-requests.module';
import { StaffModule } from './staff/staff.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MonnifyModule } from './monnify/monnify.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    RolesModule,
    UsersModule,
    SubsidiariesModule,
    ProductsModule,
    InventoryModule,
    DashboardModule,
    UploadsModule,
    FarmModule,
    CropsModule,
    LivestockModule,
    AssetsModule,
    LandModule,
    InvestmentsModule,
    AlertsModule,
    ExpensesModule,
    AuditModule,
    NotificationsModule,
    StockRequestsModule,
    FinancialRequestsModule,
    StaffModule,
    WebhooksModule,
    MonnifyModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then authorize by permission.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}


