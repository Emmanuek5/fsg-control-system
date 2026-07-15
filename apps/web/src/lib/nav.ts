import {
  ArrowLeftRight,
  Banknote,
  Beef,
  Bell,
  Bird,
  ClipboardCheck,
  ClipboardList,
  Boxes,
  Egg,
  LayoutDashboard,
  Map,
  Receipt,
  ScrollText,
  UserRound,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  TrendingUp,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission key(s) required to see this item. Any-of semantics. */
  permission?: string[];
}

export interface NavSection {
  /** Stable key used to persist the section's expanded state. */
  id: string;
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'home',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: ['dashboard:view'] }],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      { label: 'Online Shop', href: '/online-shop', icon: ShoppingCart, permission: ['products:read'] },
      { label: 'Stock Movements', href: '/stock-movements', icon: ArrowLeftRight, permission: ['inventory:read'] },
      { label: 'Stock Requests', href: '/stock-requests', icon: ClipboardList, permission: ['stock_requests:read'] },
      { label: 'Expenses', href: '/expenses', icon: Receipt, permission: ['expenses:read'] },
      { label: 'Financial Requests', href: '/financial-requests', icon: Banknote, permission: ['financial_requests:read'] },
    ],
  },
  {
    id: 'farm',
    title: 'Farm',
    items: [
      { label: 'Layers', href: '/farm/layers', icon: Egg, permission: ['farm:read'] },
      { label: 'Broilers', href: '/farm/broilers', icon: Bird, permission: ['farm:read'] },
      { label: 'Crops', href: '/farm/crops', icon: Sprout, permission: ['crops:read'] },
      { label: 'Livestock', href: '/farm/livestock', icon: Beef, permission: ['livestock:read'] },
    ],
  },
  {
    id: 'capital',
    title: 'Capital',
    items: [
      { label: 'Assets', href: '/assets', icon: Boxes, permission: ['assets:read'] },
      { label: 'Land & Estate', href: '/land-estate', icon: Map, permission: ['land:read'] },
      { label: 'Investments', href: '/investments', icon: TrendingUp, permission: ['investments:read'] },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      { label: 'Approvals', href: '/approvals', icon: ClipboardCheck, permission: ['stock_requests:approve', 'financial_requests:approve'] },
      { label: 'Notifications', href: '/notifications', icon: Bell, permission: ['notifications:read'] },
      { label: 'Alerts', href: '/alerts', icon: TriangleAlert, permission: ['alerts:read'] },
      { label: 'Staff', href: '/staff', icon: UserRound, permission: ['staff:read'] },
      { label: 'Roles & Permissions', href: '/settings/roles', icon: ShieldCheck, permission: ['roles:read'] },
      { label: 'Users', href: '/settings/users', icon: Users, permission: ['users:read'] },
      { label: 'Audit Log', href: '/audit', icon: ScrollText, permission: ['audit:read'] },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

