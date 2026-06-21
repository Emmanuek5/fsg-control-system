'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ACTION_LABELS, type PermissionAction } from '@fsg/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
  createdAt: string;
}
interface ResourceDef {
  key: string;
  label: string;
  description: string;
  actions: PermissionAction[];
}
interface Catalog {
  resources: ResourceDef[];
}

const ACTION_ORDER: PermissionAction[] = ['view', 'read', 'create', 'update', 'delete', 'manage'];

export default function RolesPage() {
  const qc = useQueryClient();
  const { can, refreshUser } = useAuth();
  const canManage = can('roles:manage');

  const rolesQ = useQuery({ queryKey: ['roles'], queryFn: () => api.get<Role[]>('/roles') });
  const catalogQ = useQuery({ queryKey: ['permissions'], queryFn: () => api.get<Catalog>('/permissions') });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rolesQ.data?.find((r) => r.id === selectedId) ?? rolesQ.data?.[0] ?? null;

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Reset editor state when the selected role changes.
  useEffect(() => {
    if (selected) {
      setChecked(new Set(selected.permissionKeys));
      setName(selected.name);
      setDescription(selected.description ?? '');
      setSelectedId(selected.id);
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allActionColumns = useMemo(() => {
    const set = new Set<PermissionAction>();
    catalogQ.data?.resources.forEach((r) => r.actions.forEach((a) => set.add(a)));
    return ACTION_ORDER.filter((a) => set.has(a));
  }, [catalogQ.data]);

  const dirty = useMemo(() => {
    if (!selected) return false;
    const orig = new Set(selected.permissionKeys);
    if (orig.size !== checked.size) return true;
    for (const k of checked) if (!orig.has(k)) return true;
    return name !== selected.name || (description ?? '') !== (selected.description ?? '');
  }, [checked, name, description, selected]);

  const savePerms = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      if (name !== selected.name || description !== (selected.description ?? '')) {
        await api.patch(`/roles/${selected.id}`, { name, description });
      }
      await api.put(`/roles/${selected.id}/permissions`, { permissionKeys: [...checked] });
    },
    onSuccess: async () => {
      toast.success('Role saved');
      await qc.invalidateQueries({ queryKey: ['roles'] });
      await refreshUser(); // your own permissions may have changed
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => api.del(`/roles/${id}`),
    onSuccess: async () => {
      toast.success('Role deleted');
      setSelectedId(null);
      await qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  function toggle(key: string) {
    if (!canManage) return;
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleResource(resource: ResourceDef, on: boolean) {
    if (!canManage) return;
    setChecked((prev) => {
      const next = new Set(prev);
      resource.actions.forEach((a) => {
        const key = `${resource.key}:${a}`;
        on ? next.add(key) : next.delete(key);
      });
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Create roles and control exactly what each role can do. Changes apply immediately."
      >
        {canManage && <CreateRoleDialog onCreated={(id) => setSelectedId(id)} />}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Role list */}
        <div className="space-y-2">
          {rolesQ.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : (
            rolesQ.data!.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedId(role.id)}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  selected?.id === role.id ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="size-4 text-primary" />
                    {role.name}
                  </span>
                  {role.isSystem && <Badge variant="secondary">System</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-3" /> {role.userCount}
                  </span>
                  <span>{role.permissionKeys.length} permissions</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Role editor */}
        <Card>
          <CardContent className="p-5">
            {!selected ? (
              <p className="py-12 text-center text-muted-foreground">Select a role to edit</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Role name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!canManage}
                      className="min-h-[38px]"
                    />
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Module
                        </th>
                        {allActionColumns.map((a) => (
                          <th
                            key={a}
                            className="p-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            {ACTION_LABELS[a]}
                          </th>
                        ))}
                        <th className="p-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          All
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogQ.data?.resources.map((resource) => {
                        const allOn = resource.actions.every((a) =>
                          checked.has(`${resource.key}:${a}`),
                        );
                        return (
                          <tr key={resource.key} className="border-b last:border-0">
                            <td className="p-3">
                              <div className="font-medium">{resource.label}</div>
                              <div className="text-xs text-muted-foreground">{resource.description}</div>
                            </td>
                            {allActionColumns.map((a) => {
                              const supported = resource.actions.includes(a);
                              const key = `${resource.key}:${a}`;
                              return (
                                <td key={a} className="p-3 text-center">
                                  {supported ? (
                                    <div className="flex justify-center">
                                      <Checkbox
                                        checked={checked.has(key)}
                                        onCheckedChange={() => toggle(key)}
                                        disabled={!canManage}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/30">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-3 text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={allOn}
                                  onCheckedChange={(v) => toggleResource(resource, Boolean(v))}
                                  disabled={!canManage}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {canManage && (
                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      {!selected.isSystem && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          disabled={deleteRole.isPending}
                          onClick={() => {
                            if (confirm(`Delete role "${selected.name}"?`)) deleteRole.mutate(selected.id);
                          }}
                        >
                          <Trash2 className="size-4" /> Delete role
                        </Button>
                      )}
                    </div>
                    <Button onClick={() => savePerms.mutate()} disabled={!dirty || savePerms.isPending}>
                      {savePerms.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save changes
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CreateRoleDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () => api.post<Role>('/roles', { name, description }),
    onSuccess: async (role) => {
      toast.success('Role created');
      await qc.invalidateQueries({ queryKey: ['roles'] });
      onCreated(role.id);
      setOpen(false);
      setName('');
      setDescription('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create role'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Farm Clerk" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this role for?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={name.trim().length < 2 || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
