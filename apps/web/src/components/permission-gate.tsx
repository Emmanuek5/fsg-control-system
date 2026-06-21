'use client';

import { useAuth } from '@/lib/auth-context';

interface CanProps {
  perm: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Renders children only when the current user has ALL of the given permissions. */
export function Can({ perm, children, fallback = null }: CanProps) {
  const { can } = useAuth();
  const perms = Array.isArray(perm) ? perm : [perm];
  return <>{can(...perms) ? children : fallback}</>;
}
