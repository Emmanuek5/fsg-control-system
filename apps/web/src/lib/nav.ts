import {
  ArrowLeftRight,
  Banknote,
  Beef,
  Bell,
  Bird,
  Boxes,
  Egg,
  LayoutDashboard,
  Map,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  TrendingUp,
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
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: ['dashboard:view'] }],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Online Shop', href: '/online-shop', icon: ShoppingCart, permission: ['products:read'] },
      { label: 'Stock Movements', href: '/stock-movements', icon: ArrowLeftRight, permission: ['inventory:read'] },
    ],
  },
  {
    title: 'Farm',
    items: [
      { label: 'Layers', href: '/farm/layers', icon: Egg, permission: ['farm:read'] },
      { label: 'Broilers', href: '/farm/broilers', icon: Bird, permission: ['farm:read'] },
      { label: 'Crops', href: '/farm/crops', icon: Sprout, permission: ['crops:read'] },
      { label: 'Livestock', href: '/farm/livestock', icon: Beef, permission: ['livestock:read'] },
    ],
  },
  {
    title: 'Capital',
    items: [
      { label: 'Assets', href: '/assets', icon: Boxes, permission: ['assets:read'] },
      { label: 'Land & Estate', href: '/land-estate', icon: Map, permission: ['land:read'] },
      { label: 'Investments', href: '/investments', icon: TrendingUp, permission: ['investments:read'] },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Alerts', href: '/alerts', icon: Bell, permission: ['alerts:read'] },
      { label: 'Roles & Permissions', href: '/settings/roles', icon: ShieldCheck, permission: ['roles:read'] },
      { label: 'Users', href: '/settings/users', icon: Users, permission: ['users:read'] },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];
