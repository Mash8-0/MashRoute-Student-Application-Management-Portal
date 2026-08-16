import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, CheckCircle2, CreditCard, AlertCircle, Clock, Loader2, Pencil, Trash2 } from 'lucide-react';
import { paymentAPI, studentAPI, applicationAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import KPICard from '../../components/common/KPICard';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { formatDate, formatCurrency } from '../../lib/utils';
import { toast } from '../../components/ui/toast';
import { useAuthStore } from '../../store/authStore';
import PaymentAccountsSettings from '../../components/settings/PaymentAccountsSettings';

function InvoiceModal({ invoice, onClose, onSaved }) {
  const isEdit = Boolean(invoice);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    studentId: invoice?.studentId || '',
    amount: invoice?.amount != null ? String(invoice.amount) : '',
    currency: invoice?.currency || 'USD',
    dueDate: invoice?.dueDate ? invoice.dueDate.split('T')[0] : '',
    description: invoice?.description || '',
    notes: invoice?.notes || '',
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  useEffect(() => {
    studentAPI.list({ limit: 200 }).then((res) => setStudents(res.data.data || [])).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.studentId || !form.amount) {
      toast.error('Student and amount are required');
      return;
    }
    setSaving(true);
    const payload = {
      studentId: form.studentId,
      amount: parseFloat(form.amount),
      currency: form.currency,
      dueDate: form.dueDate || undefined,
      description: form.description || undefined,
      notes: form.notes || undefined,
    };
    try {
      if (isEdit) {
        await paymentAPI.update(invoice.id, payload);
        toast.success('Invoice updated');
      } else {
        await paymentAPI.create(payload);
        toast.success('Invoice created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} invoice`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-background shadow-2xl border border-border">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit / Amend Invoice' : 'Create Invoice'}</h2>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium">Student *</label>
            <select className={inputClass} value={form.studentId} onChange={(e) => set('studentId', e.target.value)}>
              <option value="">— Select student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} {s.passportNumber ? `(${s.passportNumber})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Currency</label>
              <select className={inputClass} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {['USD', 'EUR', 'GBP', 'BDT', 'MYR', 'AUD', 'CAD'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Due Date</label>
            <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Description</label>
            <input className={inputClass} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Application fee, EMGS fee..." />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Internal Notes</label>
            <textarea
              className="h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional internal notes"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [activeSection, setActiveSection] = useState('invoices');
  const { user } = useAuthStore();

  const canCreate = ['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const canManage = canCreate;

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentsRes, statsRes] = await Promise.all([
        paymentAPI.list({ page, limit: 15, search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined }),
        paymentAPI.stats(),
      ]);
      setPayments(paymentsRes.data.data || []);
      setPagination(paymentsRes.data.pagination);
      setStats(statsRes.data.data);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleMarkPaid = async (id) => {
    try {
      await paymentAPI.markPaid(id);
      toast.success('Payment marked as paid');
      fetchPayments();
    } catch {
      toast.error('Failed to update payment');
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete invoice ${row.invoiceNo}? This cannot be undone.`)) return;
    setDeletingId(row.id);
    try {
      await paymentAPI.delete(row.id);
      toast.success('Invoice deleted');
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete invoice');
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      key: 'invoiceNo',
      label: 'Invoice',
      render: (val) => <span className="font-mono text-xs font-medium text-primary">{val}</span>,
    },
    {
      key: 'student',
      label: 'Student',
      render: (val) => <span className="text-sm font-medium">{val?.fullName || '—'}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (val) => <span className="text-xs text-muted-foreground">{val || '—'}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (val, row) => (
        <span className="text-sm font-semibold">{formatCurrency(val, row.currency)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDate(val) : '—'}</span>,
    },
    {
      key: 'paidAt',
      label: 'Paid',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDate(val) : '—'}</span>,
    },
    {
      key: 'id',
      label: 'Actions',
      render: (val, row) =>
        canManage ? (
          <div className="flex items-center justify-end gap-1">
            {row.status !== 'PAID' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkPaid(val)}
                className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                Mark Paid
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditInvoice(row)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
              title="Edit / Amend"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(row)}
              disabled={deletingId === val}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              title="Delete invoice"
            >
              {deletingId === val ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Manage invoices, payments, and destination accounts"
        actions={
          canCreate && activeSection === 'invoices' && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Create Invoice
            </Button>
          )
        }
      />

      {canManage && (
        <div className="flex gap-1 border-b border-border">
          <button onClick={() => setActiveSection('invoices')} className={`border-b-2 px-4 py-2 text-sm font-medium ${activeSection === 'invoices' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Invoices &amp; Payments</button>
          <button onClick={() => setActiveSection('accounts')} className={`border-b-2 px-4 py-2 text-sm font-medium ${activeSection === 'accounts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Payment Accounts</button>
        </div>
      )}

      {activeSection === 'accounts' && canManage ? <PaymentAccountsSettings /> : <>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard title="Total Invoices" value={stats?.total ?? '—'} icon={CreditCard} color="navy" loading={loading} />
        <KPICard title="Paid" value={stats?.paid ?? '—'} icon={CheckCircle2} color="green" loading={loading} />
        <KPICard title="Pending" value={stats?.pending ?? '—'} icon={Clock} color="orange" loading={loading} />
        <KPICard title="Overdue" value={stats?.overdue ?? '—'} icon={AlertCircle} color="red" loading={loading} />
      </div>

      {/* Revenue banner */}
      {stats?.totalRevenue !== undefined && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Total Revenue Collected</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice, student..."
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
            {['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'PARTIAL'].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={payments}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="No invoices found."
      />

      {showCreate && (
        <InvoiceModal
          onClose={() => setShowCreate(false)}
          onSaved={fetchPayments}
        />
      )}

      {editInvoice && (
        <InvoiceModal
          invoice={editInvoice}
          onClose={() => setEditInvoice(null)}
          onSaved={fetchPayments}
        />
      )}
      </>}
    </div>
  );
}
