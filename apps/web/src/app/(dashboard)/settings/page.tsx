'use client';

import Link from 'next/link';
import { ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';

export default function SettingsPage() {
  const { user, can } = useAuth();

  const tiles = [
    {
      href: '/settings/roles',
      title: 'Roles & Permissions',
      description: 'Create roles and edit what each role can do',
      icon: ShieldCheck,
      show: can('roles:read'),
    },
    {
      href: '/settings/users',
      title: 'Users',
      description: 'Manage accounts and assign roles',
      icon: Users,
      show: can('users:read'),
    },
  ].filter((t) => t.show);

  return (
    <div>
      <PageHeader title="Settings" description="Administration & access control" />

      <Card className="mb-6">
        <CardContent className="p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Signed in as</h2>
          <p className="mt-1 text-lg font-semibold">{user?.name}</p>
          <p className="text-sm text-muted-foreground">
            {user?.email} · {user?.role.name} · {user?.permissions.length} permissions
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href}>
              <Card className="transition-colors hover:border-primary hover:bg-accent/40">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-sm text-muted-foreground">{t.description}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
