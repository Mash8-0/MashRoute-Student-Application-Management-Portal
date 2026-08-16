import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, MoreVertical, Loader2, Shield, UserX, KeyRound } from 'lucide-react';
import { userAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from '../../components/ui/toast';
import { formatDate, getInitials } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { AGENT_CATEGORIES, categoryLabel } from '../../lib/agentCategories';

const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  TENANT_ADMIN: 'bg-blue-100 text-blue-700',
  STAFF: 'bg-gray-100 text-gray-700',
};

function UserModal({ user: editUser, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(editUser?.id);
  const [form, setForm] = useState({
    firstName: editUser?.firstName || '',
    lastName: editUser?.lastName || '',
    email: editUser?.email || '',
    role: editUser?.role || 'STAFF',
    agentCategory: editUser?.agentCategory || 'STANDARD',
    password: '',
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error('First name, last name, and email are required');
      return;
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required for new users');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
        agentCategory: form.role === 'STAFF' ? form.agentCategory : undefined,
        ...(form.password ? { password: form.password } : {}),
      };
      if (isEdit) {
        await userAPI.update(editUser.id, payload);
        toast.success('User updated');
      } else {
        await userAPI.create(payload);
        toast.success('User created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-background shadow-2xl border border-border">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit User' : 'New Staff Member'}</h2>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium">First Name *</label>
              <input className={inputClass} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="First" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Last Name *</label>
              <input className={inputClass} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Last" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Email *</label>
            <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="user@email.com" disabled={isEdit} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Role *</label>
            <select className={inputClass} value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="STAFF">Staff</option>
            <option value="REGISTERED_AGENT">Registered Agent</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
            </select>
          </div>
          {form.role === 'STAFF' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium">Agent Category</label>
              <select className={inputClass} value={form.agentCategory} onChange={(e) => set('agentCategory', e.target.value)}>
                {AGENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.tier}. {c.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Determines which university commission rate applies to this agent.
              </p>
            </div>
          )}
          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium">Password *</label>
              <input type="password" className={inputClass} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 8 characters" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ userId, userName, onClose }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await userAPI.resetPassword(userId, password);
      toast.success(`Password reset for ${userName}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-background shadow-2xl border border-border">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Reset Password</h2>
          <p className="text-xs text-muted-foreground mt-0.5">For {userName}</p>
        </div>
        <div className="p-6">
          <label className="mb-1.5 block text-xs font-medium">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleReset} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const { user: currentUser } = useAuthStore();

  const canManage = ['TENANT_ADMIN', 'SUPER_ADMIN'].includes(currentUser?.role);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userAPI.list({ page, limit: 15, search: search || undefined });
      setUsers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); }, [search]);

  const handleDelete = async (u) => {
    if (!confirm(`Delete ${u.firstName} ${u.lastName}? This cannot be undone.`)) return;
    try {
      await userAPI.delete(u.id);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const columns = [
    {
      key: 'firstName',
      label: 'User',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {getInitials(`${val} ${row.lastName}`)}
          </div>
          <div>
            <p className="text-sm font-medium">{val} {row.lastName}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (val, row) => (
        <div className="flex flex-col gap-1">
          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[val] || 'bg-gray-100 text-gray-700'}`}>
            <Shield className="h-3 w-3" />
            {val?.replace(/_/g, ' ')}
          </span>
          {val === 'STAFF' && row.agentCategory && (
            <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              {categoryLabel(row.agentCategory)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (val) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {val ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Joined',
      render: (val) => <span className="text-xs text-muted-foreground">{formatDate(val)}</span>,
    },
    {
      key: 'id',
      label: '',
      render: (val, row) => canManage && row.id !== currentUser?.id ? (
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === val ? null : val); }}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {openMenu === val && (
            <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-border bg-background shadow-lg" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setEditUser(row); setShowModal(true); setOpenMenu(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-t-lg"
              >
                Edit User
              </button>
              <button
                onClick={() => { setResetTarget(row); setOpenMenu(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <KeyRound className="h-3.5 w-3.5" /> Reset Password
              </button>
              <button
                onClick={() => { handleDelete(row); setOpenMenu(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-b-lg"
              >
                <UserX className="h-3.5 w-3.5" /> Delete User
              </button>
            </div>
          )}
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6" onClick={() => setOpenMenu(null)}>
      <PageHeader
        title="Staff Management"
        description={`${pagination?.total ?? '—'} team members`}
        actions={
          canManage && (
            <Button onClick={() => { setEditUser(null); setShowModal(true); }}>
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: pagination?.total ?? '—' },
          { label: 'Admins', value: users.filter((u) => u.role === 'TENANT_ADMIN').length },
          { label: 'Staff', value: users.filter((u) => u.role === 'STAFF').length },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-primary mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="No users found."
      />

      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          onSaved={fetchUsers}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          userId={resetTarget.id}
          userName={`${resetTarget.firstName} ${resetTarget.lastName}`}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
