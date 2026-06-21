'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, X } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/nav';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

function isActive(pathname: string, href: string) {
  if (href === '/settings') return pathname === '/settings';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const canSee = (perm?: string[]) =>
    !perm || perm.length === 0 || (!!user && perm.some((p) => user.permissions.includes(p)));

  const content = (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">FSG Work</div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
            Control System
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-auto rounded p-1 text-sidebar-foreground/70 hover:bg-white/10 lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, i) => {
          const items = section.items.filter((item) => canSee(item.permission));
          if (items.length === 0) return null;
          return (
            <div key={i}>
              {section.title && (
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4 text-[11px] text-sidebar-foreground/50">
        © {new Date().getFullYear()} FSG Work Solutions
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">{content}</aside>

      <div className={cn('fixed inset-0 z-40 lg:hidden', !mobileOpen && 'pointer-events-none')}>
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onClose}
        />
        <div
          className={cn(
            'absolute left-0 top-0 h-full shadow-xl transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {content}
        </div>
      </div>
    </>
  );
}
