import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Loader2, Search, Plus, Pencil, Trash2, CheckCircle2,
  Upload, ShieldCheck, Receipt, FileText, LogIn, RefreshCw,
} from 'lucide-react';
import { analyticsAPI } from '../../api/endpoints';
import { toast } from '../../components/ui/toast';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { getInitials } from '../../lib/utils';

// ─── Action → icon + colour mapping ───────────────────────────────────────────

const ACTION_META = {
  CREATE:                { icon: Plus,         color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Created' },
  UPDATE:                { icon: Pencil,       color: 'text-blue-600',    bg: 'bg-blue-500/10',    label: 'Updated' },
  DELETE:                { icon: Trash2,       color: 'text-red-600',     bg: 'bg-red-500/10',     label: 'Deleted' },
  ACCEPT:                { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Accepted' },
  STATUS_UPDATE:         { icon: RefreshCw,    color: 'text-violet-600',  bg: 'bg-violet-500/10',  label: 'Status changed' },
  UPLOAD_OFFER_LETTER:   { icon: Upload,       color: 'text-blue-600',    bg: 'bg-blue-500/10',    label: 'Uploaded offer letter' },
  UPLOAD_PAYMENT_PROOF:  { icon: Upload,       color: 'text-blue-600',    bg: 'bg-blue-500/10',    label: 'Uploaded payment proof' },
  UPLOAD_TUITION_PROOF:  { icon: Upload,       color: 'text-blue-600',    bg: 'bg-blue-500/10',    label: 'Uploaded tuition proof' },
  VERIFY_PAYMENT:        { icon: ShieldCheck,  color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Verified payment' },
  VERIFY_TUITION:        { icon: ShieldCheck,  color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Verified tuition' },
  ISSUE_INVOICE:         { icon: Receipt,      color: 'text-amber-600',   bg: 'bg-amber-500/10',   label: 'Issued invoice' },
  UPDATE_EMGS:           { icon: RefreshCw,    color: 'text-violet-600',  bg: 'bg-violet-500/10',  label: 'Updated EMGS' },
  ADD_NOTE:              { icon: FileText,     color: 'text-muted-foreground', bg: 'bg-muted',     label: 'Added note' },
  LOGIN:                 { icon: LogIn,        color: 'text-muted-foreground', bg: 'bg-muted',     label: 'Logged in' },
};

const FILTERS = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_UPDATE', 'VERIFY_PAYMENT', 'ISSUE_INVOICE'];

function metaFor(action) {
  return ACTION_META[action] || { icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted', label: action };
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fullTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.activityLogs({ page, limit: 30 });
      const data = res.data.data || [];
      setLogs(data);
      setHasMore(data.length === 30);
    } catch {
      toast.error('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    if (filter !== 'ALL' && log.action !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${log.action} ${log.entity} ${log.user?.firstName || ''} ${log.user?.lastName || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">System-wide audit trail across all tenants</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, action, entity..."
            className="pl-9 h-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {f === 'ALL' ? 'All' : metaFor(f).label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Activity className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No activity found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((log) => {
                const m = metaFor(log.action);
                const Icon = m.icon;
                const userName = log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System';
                const entityName = log.newValue?.fullName || log.newValue?.name || log.newValue?.referenceNo || log.entityId?.slice(0, 8);
                return (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${m.bg}`}>
                      <Icon className={`h-4 w-4 ${m.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{userName}</span>
                        <span className="text-muted-foreground"> {m.label.toLowerCase()} </span>
                        <span className="font-medium">{log.entity}</span>
                        {entityName && <span className="text-muted-foreground"> · {entityName}</span>}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {log.user?.role && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium">
                            {log.user.role.replace('_', ' ')}
                          </span>
                        )}
                        <span title={fullTime(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {getInitials(userName)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && (page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
