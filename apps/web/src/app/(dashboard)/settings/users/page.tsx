'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Role {
  id: string;
  name: string;
}
interface UserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  role: { id: string; name: string } | null;
  subsidiary: { id: string; name: string } | null;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canUpdate = can('users:update');

  const usersQ = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserRow[]>('/users') });
  const rolesQ = useQuery({ queryKey: ['roles'], queryFn: () => api.get<Role[]>('/roles') });

  const assignRole = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) =>
      api.patch(`/users/${id}`, { roleId }),
    onSuccess: async () => {
      toast.success('Role updated');
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const columns: Column<UserRow>[] = [
    {
      header: 'Name',
      cell: (u) => (
        <div>
          <div className="font-medium">{u.name}</div>
          <div className="text-xs text-muted-foreground">{u.email}</div>
        </div>
      ),
    },
    {
      header: 'Role',
      cell: (u) =>
        canUpdate ? (
          <Select
            value={u.role?.id ?? ''}
            className="h-8 w-40"
            onChange={(e) => assignRole.mutate({ id: u.id, roleId: e.target.value })}
          >
            {rolesQ.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        ) : (
          <Badge variant="secondary">{u.role?.name ?? '—'}</Badge>
        ),
    },
    { header: 'Subsidiary', cell: (u) => u.subsidiary?.name ?? '—' },
    {
      header: 'Status',
      cell: (u) =>
        u.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    { header: 'Joined', cell: (u) => fmtDate(u.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Users" description="Manage user accounts and assign roles">
        {can('users:create') && <CreateUserDialog roles={rolesQ.data ?? []} />}
      </PageHeader>
      <DataTable columns={columns} rows={usersQ.data ?? []} loading={usersQ.isLoading} />
    </div>
  );
}

function CreateUserDialog({ roles }: { roles: Role[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });

  const create = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: async () => {
      toast.success('User created');
      await qc.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      setForm({ name: '', email: '', password: '', roleId: '' });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create user'),
  });

  const valid = form.name.length >= 2 && form.email.includes('@') && form.password.length >= 6 && form.roleId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="min 6 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">Select a role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
