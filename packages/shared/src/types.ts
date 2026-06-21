/** Shared API response shapes used by both the web app and the API. */

export interface AuthUserRole {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AuthUserRole;
  subsidiaryId: string | null;
  /** effective permission keys, e.g. ["products:read", "products:create"] */
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface DashboardKpis {
  totalStockValue: number;
  salesToday: number;
  salesThisMonth: number;
  birdsAlive: number;
  eggsThisWeek: number;
  overdueMaintenance: number;
  unpaidLandBalance: number;
  investmentsNearingMaturity: number;
  activeAlerts: number;
}

export interface SubsidiaryPerformancePoint {
  subsidiary: string;
  type: string;
  revenue: number;
}

export interface EggProductionPoint {
  date: string;
  eggs: number;
}

export interface RecentActivityItem {
  id: string;
  kind: string;
  description: string;
  amount: number | null;
  occurredAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
