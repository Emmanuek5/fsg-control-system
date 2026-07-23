/**
 * Canonical permission catalog — the single source of truth for RBAC.
 *
 *  - The API seeds these into the `permissions` table and enforces them in PermissionsGuard.
 *  - The web app renders the permission matrix (Settings → Roles) from this same list.
 *
 * A permission key has the form `<resource>:<action>` (e.g. `products:create`).
 */

export type PermissionAction =
  | 'view'
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'execute'
  | 'manage';

export interface PermissionResource {
  /** stable key used in permission strings, e.g. "products" */
  key: string;
  /** human label shown in the matrix */
  label: string;
  /** short description of what the resource covers */
  description: string;
  /** actions available on this resource */
  actions: PermissionAction[];
}

export interface PermissionDef {
  key: string;
  resource: string;
  action: PermissionAction;
  description: string;
}

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  read: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  execute: 'Execute',
  manage: 'Manage',
};

const CRUD: PermissionAction[] = ['read', 'create', 'update', 'delete'];

/** Resource groups rendered as rows in the permission matrix. */
export const PERMISSION_RESOURCES: PermissionResource[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'View the executive dashboard and KPIs',
    actions: ['view'],
  },
  {
    key: 'products',
    label: 'Products / Online Shop',
    description: 'Catalogue and stock levels for the online shop',
    actions: CRUD,
  },
  {
    key: 'inventory',
    label: 'Stock Movements',
    description: 'Stock in / out / adjustment records',
    actions: CRUD,
  },
  {
    key: 'sales',
    label: 'Sales',
    description: 'Sales transactions',
    actions: ['read', 'create', 'update', 'delete', 'approve'],
  },
  {
    key: 'expenses',
    label: 'Expenses',
    description: 'Operational expenses across zones (feed, fuel, utilities, ...)',
    actions: CRUD,
  },
  {
    key: 'farm',
    label: 'Farm — Batches & Records',
    description: 'Layer/broiler batches, egg production, mortality and feed records',
    actions: CRUD,
  },
  { key: 'crops', label: 'Crops', description: 'Crop plots and harvests', actions: CRUD },
  {
    key: 'livestock',
    label: 'Livestock',
    description: 'Individual livestock animals',
    actions: CRUD,
  },
  { key: 'assets', label: 'Assets', description: 'Company assets and equipment', actions: CRUD },
  {
    key: 'maintenance',
    label: 'Maintenance',
    description: 'Asset maintenance schedules and logs',
    actions: CRUD,
  },
  {
    key: 'land',
    label: 'Land & Estate',
    description: 'Land plots and their payment schedules',
    actions: CRUD,
  },
  {
    key: 'investments',
    label: 'Investments',
    description: 'Investment instruments and maturities',
    actions: CRUD,
  },
  {
    key: 'alerts',
    label: 'Alerts',
    description: 'System alerts and notifications',
    actions: ['read', 'update', 'delete'],
  },
  {
    key: 'stock_requests',
    label: 'Stock Requests',
    description: 'Approval workflow for stock in, out and adjustments',
    actions: ['read', 'create', 'approve', 'delete'],
  },
  {
    key: 'financial_requests',
    label: 'Financial Requests',
    description: 'Expense, disbursement, airtime, data and bill approval requests',
    actions: ['read', 'create', 'approve', 'delete'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'User-specific action notifications and read state',
    actions: ['read', 'update'],
  },
  {
    key: 'staff',
    label: 'Staff',
    description: 'Staff profiles, assignments and bank details',
    actions: CRUD,
  },
  {
    key: 'finance',
    label: 'Financial Insight',
    description: 'Company-wide financial visibility: costs, valuations, totals and summaries',
    actions: ['read'],
  },
  {
    key: 'payments',
    label: 'Payments',
    description: 'Future provider payment execution',
    actions: ['read', 'execute'],
  },
  {
    key: 'payroll',
    label: 'Payroll',
    description: 'Future payroll automation',
    actions: ['read', 'manage'],
  },
  {
    key: 'subsidiaries',
    label: 'Subsidiaries',
    description: 'Business subsidiaries / divisions',
    actions: CRUD,
  },
  { key: 'users', label: 'Users', description: 'User accounts', actions: CRUD },
  {
    key: 'roles',
    label: 'Roles & Permissions',
    description: 'Create roles and edit the permissions each role has',
    actions: ['read', 'manage'],
  },
  {
    key: 'audit',
    label: 'Audit Log',
    description: 'View the system audit trail of who changed what',
    actions: ['read'],
  },
];

function describe(resourceLabel: string, action: PermissionAction): string {
  switch (action) {
    case 'view':
      return `View ${resourceLabel}`;
    case 'read':
      return `View ${resourceLabel}`;
    case 'create':
      return `Create ${resourceLabel}`;
    case 'update':
      return `Edit ${resourceLabel}`;
    case 'delete':
      return `Delete ${resourceLabel}`;
    case 'approve':
      return `Approve ${resourceLabel}`;
    case 'execute':
      return `Execute ${resourceLabel}`;
    case 'manage':
      return `Manage ${resourceLabel}`;
  }
}

/** Flattened list of every permission. */
export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_RESOURCES.flatMap((resource) =>
  resource.actions.map((action) => ({
    key: `${resource.key}:${action}`,
    resource: resource.key,
    action,
    description: describe(resource.label, action),
  })),
);

export const ALL_PERMISSION_KEYS: string[] = ALL_PERMISSIONS.map((p) => p.key);

/** Helper: every permission key for a given resource. */
export function permissionsFor(resource: string): string[] {
  return ALL_PERMISSIONS.filter((p) => p.resource === resource).map((p) => p.key);
}

/** Helper: build a typed permission key. */
export function perm(resource: string, action: PermissionAction): string {
  return `${resource}:${action}`;
}

// ─── Default seeded roles (fully editable after seeding) ──────────────────

export interface DefaultRoleDef {
  name: string;
  description: string;
  isSystem: boolean;
  /** 'ALL' grants every permission; otherwise an explicit list of keys */
  permissions: 'ALL' | string[];
}

const managerPermissions: string[] = [
  'dashboard:view',
  ...permissionsFor('products'),
  ...permissionsFor('inventory'),
  'sales:read',
  'sales:create',
  'sales:update',
  'sales:delete',
  // End-of-day verification defaults to Admin only.
  ...permissionsFor('expenses'),
  ...permissionsFor('farm'),
  ...permissionsFor('crops'),
  ...permissionsFor('livestock'),
  ...permissionsFor('assets'),
  ...permissionsFor('maintenance'),
  ...permissionsFor('land'),
  ...permissionsFor('investments'),
  ...permissionsFor('alerts'),
  ...permissionsFor('stock_requests'),
  ...permissionsFor('financial_requests'),
  ...permissionsFor('notifications'),
  ...permissionsFor('staff'),
  'finance:read',
  'payments:read',
  'payments:execute',
  'payroll:read',
  'subsidiaries:read',
  'users:read',
];

const staffPermissions: string[] = [
  'dashboard:view',
  'products:read',
  'products:create',
  'products:update',
  'inventory:read',
  'inventory:create',
  'sales:read',
  'sales:create',
  'expenses:read',
  'expenses:create',
  'farm:read',
  'farm:create',
  'farm:update',
  'crops:read',
  'crops:create',
  'crops:update',
  'livestock:read',
  'livestock:create',
  'livestock:update',
  'assets:read',
  'maintenance:read',
  'maintenance:create',
  'maintenance:update',
  'alerts:read',
  'stock_requests:read',
  'stock_requests:create',
  'financial_requests:read',
  'financial_requests:create',
  'notifications:read',
  'notifications:update',
];

export const DEFAULT_ROLES: DefaultRoleDef[] = [
  {
    name: 'Admin',
    description: 'Full access to every part of the system, including roles and users.',
    isSystem: true,
    permissions: 'ALL',
  },
  {
    name: 'Manager',
    description: 'Runs day-to-day operations across all subsidiaries.',
    isSystem: true,
    permissions: managerPermissions,
  },
  {
    name: 'Staff',
    description: 'Records daily data entry; no destructive or admin actions.',
    isSystem: true,
    permissions: staffPermissions,
  },
];
