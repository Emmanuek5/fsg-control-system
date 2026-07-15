'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StaffDepartment as StaffDepartmentValues, StaffStatus as StaffStatusValues } from '@fsg/shared';
type StaffDepartment = (typeof StaffDepartmentValues)[keyof typeof StaffDepartmentValues];
type StaffStatus = (typeof StaffStatusValues)[keyof typeof StaffStatusValues];
const StaffDepartment = StaffDepartmentValues;
const StaffStatus = StaffStatusValues;
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { departmentLabel, staffStatusLabel } from '@/lib/approval';
import { fmtDate, toDateInput } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BankAccountFields } from '@/components/payments/bank-account-fields';

interface Subsidiary { id: string; name: string; }
interface UserOpt { id: string; name: string; email: string; }
interface Staff { id: string; name: string; phone: string | null; email: string | null; jobTitle: string | null; department: StaffDepartment; status: StaffStatus; startDate: string | null; bankName: string | null; bankCode: string | null; accountNumber: string | null; accountName: string | null; linkedUserId: string | null; subsidiaryId: string | null; subsidiary: { id: string; name: string } | null; linkedUser: { id: string; name: string; email: string } | null; }

export default function StaffPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const staffQ = useQuery({ queryKey: ['staff'], queryFn: () => api.get<Staff[]>('/staff') });
  const subsQ = useQuery({ queryKey: ['subsidiaries'], queryFn: () => api.get<Subsidiary[]>('/subsidiaries'), enabled: can('subsidiaries:read') });
  const usersQ = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserOpt[]>('/users'), enabled: can('users:read') });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/staff/${id}`), onSuccess: async () => { toast.success('Staff record deleted'); await qc.invalidateQueries({ queryKey: ['staff'] }); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed') });
  const columns: Column<Staff>[] = [
    { header: 'Name', cell: (s) => <div><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.email ?? s.phone ?? '-'}</div></div> },
    { header: 'Role', cell: (s) => s.jobTitle ?? '-' },
    { header: 'Department', cell: (s) => <Badge variant="secondary">{departmentLabel[s.department]}</Badge> },
    { header: 'Zone', cell: (s) => s.subsidiary?.name ?? '-' },
    { header: 'Bank', cell: (s) => s.bankName ? <div><div>{s.bankName}</div><div className="text-xs text-muted-foreground">{s.accountNumber} · {s.accountName}</div></div> : '-' },
    { header: 'Status', cell: (s) => <Badge variant={s.status === 'ACTIVE' ? 'success' : 'secondary'}>{staffStatusLabel[s.status]}</Badge> },
    { header: 'Start date', cell: (s) => fmtDate(s.startDate) },
    { header: '', className: 'text-right', cell: (s) => <div className="flex justify-end gap-1">{can('staff:update') && <StaffDialog staff={s} subsidiaries={subsQ.data ?? []} users={usersQ.data ?? []} trigger={<Button variant="ghost" size="icon" aria-label="Edit"><Pencil className="size-4" /></Button>} />}{can('staff:delete') && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm('Delete this staff record?')) remove.mutate(s.id); }}><Trash2 className="size-4" /></Button>}</div> },
  ];
  return <div><PageHeader title="Staff" description="Staff assignments, departments and bank details for future payroll">{can('staff:create') && <StaffDialog subsidiaries={subsQ.data ?? []} users={usersQ.data ?? []} trigger={<Button><Plus className="size-4" /> Add staff</Button>} />}</PageHeader><DataTable columns={columns} rows={staffQ.data ?? []} loading={staffQ.isLoading} empty="No staff records yet." /></div>;
}

function StaffDialog({ staff, subsidiaries, users, trigger }: { staff?: Staff; subsidiaries: Subsidiary[]; users: UserOpt[]; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: staff?.name ?? '', phone: staff?.phone ?? '', email: staff?.email ?? '', jobTitle: staff?.jobTitle ?? '', department: staff?.department ?? StaffDepartment.OTHER, subsidiaryId: staff?.subsidiaryId ?? '', status: staff?.status ?? StaffStatus.ACTIVE, startDate: toDateInput(staff?.startDate), bankName: staff?.bankName ?? '', bankCode: staff?.bankCode ?? '', accountNumber: staff?.accountNumber ?? '', accountName: staff?.accountName ?? '', linkedUserId: staff?.linkedUserId ?? '' });
  const save = useMutation({ mutationFn: () => { const payload = { ...form, subsidiaryId: form.subsidiaryId || null, linkedUserId: form.linkedUserId || null, phone: form.phone || null, email: form.email || null, jobTitle: form.jobTitle || null, startDate: form.startDate || null, bankName: form.bankName || null, bankCode: form.bankCode || null, accountNumber: form.accountNumber || null, accountName: form.accountName || null }; return staff ? api.patch(`/staff/${staff.id}`, payload) : api.post('/staff', payload); }, onSuccess: async () => { toast.success(staff ? 'Staff updated' : 'Staff added'); await qc.invalidateQueries({ queryKey: ['staff'] }); setOpen(false); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed') });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>{staff ? 'Edit staff' : 'Add staff'}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div className="space-y-1.5"><Label>Job title</Label><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></div><div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div><div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div className="space-y-1.5"><Label>Department</Label><Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value as StaffDepartment })}>{Object.values(StaffDepartment).map((d) => <option key={d} value={d}>{departmentLabel[d]}</option>)}</Select></div><div className="space-y-1.5"><Label>Zone</Label><Select value={form.subsidiaryId} onChange={(e) => setForm({ ...form, subsidiaryId: e.target.value })}><option value="">None</option>{subsidiaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div><div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StaffStatus })}>{Object.values(StaffStatus).map((s) => <option key={s} value={s}>{staffStatusLabel[s]}</option>)}</Select></div><div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div><BankAccountFields value={{ bankCode: form.bankCode, bankName: form.bankName, accountNumber: form.accountNumber, accountName: form.accountName }} onChange={(v) => setForm({ ...form, bankCode: v.bankCode, bankName: v.bankName, accountNumber: v.accountNumber, accountName: v.accountName })} /><div className="space-y-1.5"><Label>Linked user</Label><Select value={form.linkedUserId} onChange={(e) => setForm({ ...form, linkedUserId: e.target.value })}><option value="">None</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</Select></div></div><DialogFooter><Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />}{staff ? 'Save' : 'Add staff'}</Button></DialogFooter></DialogContent></Dialog>;
}


