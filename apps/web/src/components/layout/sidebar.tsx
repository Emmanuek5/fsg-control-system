'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, Sprout, X } from 'lucide-react';
import { NAV_SECTIONS, type NavSection } from '@/lib/nav';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const OPEN_STATE_KEY = 'fsg_nav_open';

function isActive(pathname: string, href: string) {
  if (href === '/settings') return pathname === '/settings';
  return pathname === href || pathname.startsWith(href + '/');
}

function sectionHasActive(section: NavSection, pathname: string) {
  return section.items.some((item) => isActive(pathname, item.href));
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  // All sections start open (matches the server render); the saved state is
  // applied after mount so SSR and first client render agree.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OPEN_STATE_KEY);
      if (saved) setOpen(JSON.parse(saved));
    } catch {
      /* ignore corrupt state */
    }
    setHydrated(true);
  }, []);

  // The section holding the current page is always forced open.
  const isOpen = (section: NavSection) =>
    !hydrated || open[section.id] !== false || sectionHasActive(section, pathname);

  const toggle = (section: NavSection) => {
    const next = { ...open, [section.id]: !isOpen(section) };
    setOpen(next);
    try {
      window.localStorage.setItem(OPEN_STATE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const canSee = (perm?: string[]) =>
    !perm || perm.length === 0 || (!!user && perm.some((p) => user.permissions.includes(p)));

  const content = (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
          <Sprout className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold tracking-tight text-white">FSG Work</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/55">
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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => canSee(item.permission));
          if (items.length === 0) return null;
          const expanded = isOpen(section);

          const links = (
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
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-white'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary transition-opacity',
                        active ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <Icon
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        active ? 'text-sidebar-primary' : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground',
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );

          if (!section.title) {
            return <div key={section.id}>{links}</div>;
          }

          return (
            <div key={section.id} className="pt-2">
              <button
                onClick={() => toggle(section)}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground/75"
                aria-expanded={expanded}
              >
                {section.title}
                <ChevronDown
                  className={cn('size-3.5 transition-transform duration-200', !expanded && '-rotate-90')}
                />
              </button>
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-200 ease-out',
                  expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="overflow-hidden">{links}</div>
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
            'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity',
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
