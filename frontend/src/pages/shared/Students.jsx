import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { studentAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../lib/utils';
import { toast } from '../../components/ui/toast';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const canCreate = ['TENANT_ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(user?.role);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studentAPI.list({ page, limit: 15, search: search || undefined });
      setStudents(res.data.data || []);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { setPage(1); }, [search]);

  const columns = [
    {
      key: 'fullName',
      label: 'Student',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {val?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{val}</p>
            <p className="text-xs text-muted-foreground">{row.email || row.phone || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'passportNumber',
      label: 'Passport',
      render: (val) => <span className="font-mono text-xs">{val || '—'}</span>,
    },
    {
      key: 'nationality',
      label: 'Nationality',
      render: (val) => <span className="text-sm">{val || '—'}</span>,
    },
    {
      key: 'hasIELTS',
      label: 'IELTS',
      render: (val, row) => val ? (
        <span className="text-xs font-semibold text-emerald-600">{row.ieltsScore || '✓'}</span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: '_count',
      label: 'Apps',
      render: (val) => (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {val?.applications || 0}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Added',
      render: (val) => <span className="text-xs text-muted-foreground">{formatDate(val)}</span>,
    },
    {
      key: 'id',
      label: '',
      render: (val) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/students/${val}`)} className="text-xs">
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description={`${pagination?.total ?? '—'} registered students`}
        actions={
          canCreate && (
            <Button onClick={() => navigate('/students/new')}>
              <Plus className="h-4 w-4" />
              Add Student
            </Button>
          )
        }
      />

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, passport..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={students}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="No students found. Add your first student."
      />
    </div>
  );
}
