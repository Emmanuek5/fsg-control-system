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
  /** Financial KPIs are null when the requester lacks the gating permission
   *  (finance:read for money figures; land:read / investments:read for theirs). */
  totalStockValue: number | null;
  salesToday: number | null;
  salesThisMonth: number | null;
  birdsAlive: number;
  eggsThisWeek: number;
  overdueMaintenance: number;
  unpaidLandBalance: number | null;
  investmentsNearingMaturity: number | null;
  activeAlerts: number;
}

export interface SubsidiaryPerformancePoint {
  subsidiary: string;
  type: string;
  revenue: number;
}

/**
 * Sales performance for one section (subsidiary) over a filtered period.
 *
 * `subsidiaryId` is null for the bucket holding sales recorded before anyone
 * said where they came from — those exist and hiding them would make the
 * shares add up to less than the total on screen.
 */
export interface SalesBySubsidiaryPoint {
  subsidiaryId: string | null;
  subsidiary: string;
  type: string | null;
  revenue: number;
  subtotal: number;
  logistics: number;
  count: number;
  /** Fraction of the period's total revenue, 0–1. */
  share: number;
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
  actor: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
