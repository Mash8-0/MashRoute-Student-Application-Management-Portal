import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Building2, CheckCircle2, AlertTriangle, Users,
  Eye, Edit, Ban, Play, Trash2, Loader2,
} from 'lucide-react';
import { tenantAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import KPICard from '../../components/common/KPICard';
import StatusBadge from '../../components/common/StatusBadge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { formatDate } from '../../lib/utils';
import { toast } from '../../components/ui/toast';

const PLAN_STYLES = {
  STARTER:      'bg-blue-500/10 text-blue-600',
  PROFESSIONAL: 'bg-emerald-500/10 text-emerald-600',
  ENTERPRISE:   'bg-amber-500/10 text-amber-600',
};

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actioningId, setActioningId] = useState(null);
  const navigate = useNavigate();

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        tenantAPI.list({ page, limit: 15, search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined }),
        tenantAPI.stats(),
      ]);
      setTenants(listRes.data.data || []);
      setPagination(listRes.data.pagination);
      setStats(statsRes.data.data);
    } catch {
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const stop = (e) => e.stopPropagation();

  const handleSuspend = async (id) => {
    if (!confirm('Suspend this tenant? All their users will lose access.')) return;
    setActioningId(id);
    try {
      await tenantAPI.suspend(id);
      toast.success('Tenant suspended');
      fetchTenants();
    } catch {
      toast.error('Failed to suspend tenant');
    } finally {
      setActioningId(null);
    }
  };

  const handleActivate = async (id) => {
    setActioningId(id);
    try {
      await tenantAPI.activate(id);
      toast.success('Tenant activated');
      fetchTenants();
    } catch {
      toast.error('Failed to activate tenant');
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`PERMANENTLY DELETE ${row.name}? This deletes ALL their students, applications, payments and users. This cannot be undone.`)) return;
    if (!confirm('Are you absolutely sure? This is irreversible.')) return;
    setActioningId(row.id);
    try {
      await tenantAPI.delete(row.id);
      toast.success('Tenant deleted');
      fetchTenants();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete tenant');
    } finally {
      setActioningId(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Company',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            {val?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{val}</p>
            <p className="text-xs text-muted-foreground">{row.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (val) => <span className="text-xs">{val || '—'}</span>,
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (val) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${PLAN_STYLES[val] || 'bg-primary/10 text-primary'}`}>
          {val}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: '_count',
      label: 'Usage',
      render: (val) => (
        <span className="text-xs text-muted-foreground">
          {val?.users ?? 0} users · {val?.students ?? 0} students
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (val) => <span className="text-xs text-muted-foreground">{formatDate(val)}</span>,
    },
    {
      key: 'id',
      label: 'Actions',
      render: (val, row) => (
        <div className="flex items-center justify-end gap-1" onClick={stop}>
          <Button
            variant="ghost" size="sm" title="View"
            onClick={() => navigate(`/super-admin/tenants/${val}`)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm" title="Edit"
            onClick={() => navigate(`/super-admin/tenants/${val}/edit`)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          {row.status === 'ACTIVE' ? (
            <Button
              variant="ghost" size="sm" title="Suspend"
              onClick={() => handleSuspend(val)} disabled={actioningId === val}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
            >
              {actioningId === val ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
            </Button>
          ) : (
            <Button
              variant="ghost" size="sm" title="Activate"
              onClick={() => handleActivate(val)} disabled={actioningId === val}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
            >
              {actioningId === val ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button
            variant="ghost" size="sm" title="Delete"
            onClick={() => handleDelete(row)} disabled={actioningId === val}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Tenants"
        description={`${pagination?.total ?? stats?.total ?? '—'} companies on the platform`}
        actions={
          <Button onClick={() => navigate('/super-admin/tenants/new')}>
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Total Tenants" value={stats?.total ?? '—'} icon={Building2} color="navy" loading={loading} />
        <KPICard title="Active" value={stats?.active ?? '—'} icon={CheckCircle2} color="green" loading={loading} />
        <KPICard title="Suspended" value={stats?.suspended ?? '—'} icon={AlertTriangle} color="orange" loading={loading} />
        <KPICard
          title="Total Users"
          value={tenants.reduce((sum, t) => sum + (t._count?.users || 0), 0)}
          icon={Users}
          color="navy"
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {['ACTIVE', 'SUSPENDED', 'PENDING', 'CANCELLED'].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/super-admin/tenants/${row.id}`)}
        emptyMessage="No tenants yet. Create the first one."
      />
    </div>
  );
}
