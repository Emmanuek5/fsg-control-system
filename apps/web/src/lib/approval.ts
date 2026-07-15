import type { ApprovalStatus, FinancialRequestType, MovementType, StaffDepartment, StaffStatus } from '@fsg/shared';

export const statusVariant: Record<ApprovalStatus, 'default' | 'success' | 'destructive' | 'warning' | 'secondary'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  DENIED: 'destructive',
  NEEDS_INFO: 'default',
  CANCELLED: 'secondary',
};

export const statusLabel: Record<ApprovalStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  NEEDS_INFO: 'Needs info',
  CANCELLED: 'Cancelled',
};

export const movementLabel: Record<MovementType, string> = {
  IN: 'Stock In',
  OUT: 'Stock Out',
  ADJUSTMENT: 'Adjustment',
};

export const financialTypeLabel: Record<FinancialRequestType, string> = {
  CASH_EXPENSE: 'Cash Expense',
  BANK_TRANSFER: 'Bank Transfer',
  AIRTIME: 'Airtime',
  DATA_BUNDLE: 'Data Bundle',
  ELECTRICITY_BILL: 'Electricity Bill',
};

export const departmentLabel: Record<StaffDepartment, string> = {
  FARM: 'Farm',
  SHOP: 'Shop',
  HR: 'HR',
  ASSETS: 'Assets',
  CROPS: 'Crops',
  LIVESTOCK: 'Livestock',
  FINANCE: 'Finance',
  ADMIN: 'Admin',
  OTHER: 'Other',
};

export const staffStatusLabel: Record<StaffStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  LEFT: 'Left',
};
