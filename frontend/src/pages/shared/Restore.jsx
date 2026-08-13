import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArchiveRestore, FileText, GraduationCap, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react';
import { applicationAPI, studentAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../lib/utils';
import { toast } from '../../components/ui/toast';

const tabs = [
  { value: 'students', label: 'Students', icon: GraduationCap },
  { value: 'applications', label: 'Applications', icon: FileText },
];

export default function Restore() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('students');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const canRestore = ['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        search: search || undefined,
      };
      const res = activeTab === 'students'
        ? await studentAPI.listDeleted(params)
        : await applicationAPI.listDeleted(params);
      setRows(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load deleted records');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search]);

  useEffect(() => { fetchDeleted(); }, [fetchDeleted]);
  useEffect(() => { setPage(1); }, [activeTab, search]);

  const handleRestore = async (record) => {
    const label = activeTab === 'students'
      ? record.fullName || 'this student'
      : record.referenceNo || 'this application';
    if (!window.confirm(`Restore ${label}?`)) return;

    try {
      if (activeTab === 'students') {
        await studentAPI.restore(record.id);
        toast.success('Student profile restored');
      } else {
        await applicationAPI.restore(record.id);
        toast.success('Application restored');
      }
      fetchDeleted();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed');
    }
  };

  const handlePermanentDelete = async (record) => {
    const label = activeTab === 'students'
      ? record.fullName || 'this student'
      : record.referenceNo || 'this application';
    const typed = window.prompt(`Permanently delete ${label}? This cannot be undone.\n\nType DELETE to confirm.`);
    if (typed !== 'DELETE') return;

    try {
      if (activeTab === 'students') {
        await studentAPI.permanentlyDelete(record.id);
        toast.success('Student profile permanently deleted');
      } else {
        await applicationAPI.permanentlyDelete(record.id);
        toast.success('Application permanently deleted');
      }
      fetchDeleted();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Permanent delete failed');
    }
  };

  if (!canRestore) return <Navigate to="/dashboard" replace />;

  const studentColumns = [
    {
      key: 'fullName',
      label: 'Student',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {val?.charAt(0)?.toUpperCase() || 'S'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{val || 'Unnamed Student'}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email || row.phone || 'No contact saved'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'passportNumber',
      label: 'Passport',
      render: (val) => <span className="font-mono text-xs">{val || '-'}</span>,
    },
    {
      key: 'nationality',
      label: 'Nationality',
      render: (val) => <span className="text-sm">{val || '-'}</span>,
    },
    {
      key: '_count',
      label: 'Apps',
      render: (val) => <Badge variant="outline">{val?.applications || 0}</Badge>,
    },
    {
      key: 'deletedAt',
      label: 'Deleted',
      render: (val) => <span className="text-xs text-muted-foreground">{formatDate(val)}</span>,
    },
    {
      key: 'id',
      label: '',
      render: (_, row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleRestore(row)}>
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handlePermanentDelete(row)}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const applicationColumns = [
    {
      key: 'referenceNo',
      label: 'Reference',
      render: (val) => <span className="font-mono text-xs font-semibold text-primary">{val || '-'}</span>,
    },
    {
      key: 'student',
      label: 'Student',
      render: (val) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{val?.fullName || 'Unknown Student'}</p>
          <p className="truncate text-xs text-muted-foreground">{val?.passportNumber || val?.nationality || '-'}</p>
        </div>
      ),
    },
    {
      key: 'university',
      label: 'University',
      render: (val) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{val?.name || '-'}</p>
          <p className="truncate text-xs text-muted-foreground">{val?.country || ''}</p>
        </div>
      ),
    },
    {
      key: 'program',
      label: 'Program',
      render: (val) => <span className="text-sm">{val || '-'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'deletedAt',
      label: 'Deleted',
      render: (val) => <span className="text-xs text-muted-foreground">{formatDate(val)}</span>,
    },
    {
      key: 'id',
      label: '',
      render: (_, row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleRestore(row)}>
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handlePermanentDelete(row)}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columns = activeTab === 'students' ? studentColumns : applicationColumns;
  const activeLabel = activeTab === 'students' ? 'student profiles' : 'applications';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restore"
        description={`Recover deleted ${activeLabel}`}
        leading={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArchiveRestore className="h-5 w-5" />
          </div>
        }
        actions={
          <Button variant="outline" onClick={fetchDeleted} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-full rounded-lg border border-border bg-card p-1 md:w-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors md:flex-none ${
                  selected ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={activeTab === 'students' ? 'Search name, passport...' : 'Search student, reference...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={`No deleted ${activeLabel} found.`}
      />
    </div>
  );
}
