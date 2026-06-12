import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, RefreshCw, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import { applicationAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuthStore } from '../../store/authStore';
import { formatDate, formatStatusLabel, APPLICATION_STATUSES, getPriorityColor } from '../../lib/utils';
import { toast } from '../../components/ui/toast';

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  // Allow deep-linking a status filter from the dashboard (e.g. /applications?status=COMPLETED)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [liveUpdate, setLiveUpdate] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const canCreate = ['TENANT_ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(user?.role);

  const fetchApplications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: 15, search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined };
      const res = await applicationAPI.list(params);
      setApplications(res.data.data || []);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  // Live socket events — refresh list silently when status changes or new app arrives
  useEffect(() => {
    const handleStatusChange = () => {
      setLiveUpdate(true);
      fetchApplications(true);
      setTimeout(() => setLiveUpdate(false), 2000);
    };
    window.addEventListener('mashroute:statusChanged', handleStatusChange);
    window.addEventListener('mashroute:applicationCreated', handleStatusChange);
    return () => {
      window.removeEventListener('mashroute:statusChanged', handleStatusChange);
      window.removeEventListener('mashroute:applicationCreated', handleStatusChange);
    };
  }, [fetchApplications]);

  const columns = [
    {
      key: 'referenceNo',
      label: 'Reference',
      render: (val) => <span className="font-mono text-xs font-semibold text-primary">{val}</span>,
    },
    {
      key: 'student',
      label: 'Student',
      render: (val) => (
        <div>
          <p className="text-sm font-medium">{val?.fullName}</p>
          <p className="text-xs text-muted-foreground">{val?.nationality}</p>
        </div>
      ),
    },
    {
      key: 'university',
      label: 'University',
      render: (val) => (
        <div>
          <p className="text-sm">{val?.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{val?.country || ''}</p>
        </div>
      ),
    },
    {
      key: 'program',
      label: 'Program',
      render: (val) => <span className="text-sm">{val || '—'}</span>,
    },
    {
      key: 'intake',
      label: 'Intake',
      render: (val, row) => <span className="text-sm">{val ? `${val} ${row.intakeYear || ''}` : '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={val} />
          {!row.isAccepted && val === 'SUBMITTED' && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
              Pending Acceptance
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (val) => (
        <span className={`text-xs font-semibold ${getPriorityColor(val)}`}>{val}</span>
      ),
    },
    {
      key: 'agent',
      label: 'Agent',
      render: (val) => val
        ? <span className="text-sm">{val.firstName} {val.lastName}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (val) => <span className="text-xs text-muted-foreground">{formatDate(val)}</span>,
    },
    {
      key: 'id',
      label: '',
      render: (val) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/applications/${val}`)} className="text-xs">
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description={`${pagination?.total ?? '—'} total applications`}
        actions={
          <div className="flex items-center gap-2">
            {liveUpdate && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                <Wifi className="h-3 w-3" />
                Live update
              </motion.div>
            )}
            {canCreate && (
              <Button onClick={() => navigate('/applications/new')}>
                <Plus className="h-4 w-4" />
                New Application
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {APPLICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{formatStatusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => fetchApplications()} className="h-9">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={applications}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="No applications found."
      />
    </div>
  );
}
