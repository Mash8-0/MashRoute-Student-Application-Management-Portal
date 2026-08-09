import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, FileText, CreditCard, CheckCircle2,
  XCircle, Clock, RefreshCw, Plus, UserPlus, ChevronRight,
  PlaneLanding, AlertTriangle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { analyticsAPI } from '../../api/endpoints';
import KPICard from '../../components/common/KPICard';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, timeAgo } from '../../lib/utils';

const COLORS = ['#6172f3', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const fetchDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await analyticsAPI.dashboard();
      setData(res.data.data);
      setUpdatedAt(new Date());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const overview = data?.overview || {};
  const monthlyData = Array.isArray(data?.monthlyApplications) ? data.monthlyApplications : [];
  const statusData = (data?.applicationsByStatus || []).map((s, i) => ({
    name: s.status.replace(/_/g, ' '),
    status: s.status,
    value: s._count.status,
    color: COLORS[i % COLORS.length],
  }));

  const goStatus = (status) => navigate(`/applications?status=${status}`);
  const goMdac = (mdac) => navigate(`/applications?mdac=${mdac}`);

  // Greet the company by name for the tenant admin; agents/staff by their full name.
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const greetName = user?.role === 'TENANT_ADMIN' ? (user?.tenant?.name || fullName) : fullName;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}${greetName ? `, ${greetName}` : ''}`}
        description={
          updatedAt
            ? `Your application management overview · updated ${timeAgo(updatedAt)}`
            : 'Your application management overview'
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => fetchDashboard(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/students/new')}>
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Student</span>
            </Button>
            <Button size="sm" onClick={() => navigate('/applications/new')}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Application</span>
            </Button>
          </>
        }
      />

      {/* KPI Grid — clickable */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Students"
          value={loading ? '—' : overview.totalStudents?.toLocaleString()}
          icon={GraduationCap}
          color="navy"
          loading={loading}
          subtitle="registered students"
          onClick={() => navigate('/students')}
        />
        <KPICard
          title="Applications"
          value={loading ? '—' : overview.totalApplications?.toLocaleString()}
          icon={FileText}
          color="blue"
          loading={loading}
          subtitle="view all"
          onClick={() => navigate('/applications')}
        />
        <KPICard
          title="Approved"
          value={loading ? '—' : (overview.approved || 0).toLocaleString()}
          icon={CheckCircle2}
          color="green"
          loading={loading}
          subtitle="visa approvals"
          onClick={() => goStatus('VISA_APPROVED')}
        />
        <KPICard
          title="Revenue"
          value={loading ? '—' : formatCurrency(overview.totalRevenue)}
          icon={CreditCard}
          color="purple"
          loading={loading}
          subtitle={`${overview.paidInvoices || 0} paid invoices`}
          onClick={() => navigate('/payments')}
        />
      </div>

      {/* Second row — clickable */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          title="Pending"
          value={loading ? '—' : (overview.pending || 0).toLocaleString()}
          icon={Clock}
          color="orange"
          loading={loading}
          subtitle="drafts awaiting submission"
          onClick={() => goStatus('DRAFT')}
        />
        <KPICard
          title="Completed"
          value={loading ? '—' : (overview.completed || 0).toLocaleString()}
          icon={CheckCircle2}
          color="green"
          loading={loading}
          subtitle="successful applications"
          onClick={() => goStatus('COMPLETED')}
        />
        <KPICard
          title="Rejected"
          value={loading ? '—' : (overview.rejected || 0).toLocaleString()}
          icon={XCircle}
          color="red"
          loading={loading}
          subtitle="not approved"
          onClick={() => goStatus('REJECTED')}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlaneLanding className="h-4 w-4 text-primary" />
            MDAC Action Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Eligible now', data?.mdacActionRequired?.eligibleNow || 0, 'eligible_now'],
              ['Due tomorrow', data?.mdacActionRequired?.dueTomorrow || 0, 'due_tomorrow'],
              ['Due today', data?.mdacActionRequired?.dueToday || 0, 'due_today'],
              ['Unverified', data?.mdacActionRequired?.submittedUnverified || 0, 'submitted_unverified'],
              ['Needs review', data?.mdacActionRequired?.needsReview || 0, 'needs_review'],
              ['Overdue', data?.mdacActionRequired?.overdue || 0, 'overdue'],
            ].map(([label, value, filter]) => (
              <button
                key={filter}
                type="button"
                onClick={() => goMdac(filter)}
                className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  {(filter === 'due_today' || filter === 'overdue') && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                </div>
                <p className="mt-1 text-2xl font-bold text-foreground">{loading ? '—' : value}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly applications area chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Applications Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorApp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6172f3" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6172f3" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Applications"
                    stroke="#6172f3"
                    strokeWidth={2}
                    fill="url(#colorApp)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status pie chart — segments clickable */}
        <Card>
          <CardHeader>
            <CardTitle>By Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(entry) => entry?.status && goStatus(entry.status)}
                    className="cursor-pointer focus:outline-none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent applications — rows clickable */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Applications</CardTitle>
            <button
              onClick={() => navigate('/applications')}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (data?.recentApplications || []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No applications yet</p>
            ) : (
              <div className="divide-y divide-border">
                {(data?.recentApplications || []).map((app) => (
                  <button
                    key={app.id}
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className="flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{app.student?.fullName}</p>
                      <p className="text-xs text-muted-foreground">{app.university?.name || 'N/A'} · {app.referenceNo}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={app.status} />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(app.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent performance — rows clickable */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Agent Performance</CardTitle>
            <button
              onClick={() => navigate('/users')}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Manage staff <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (data?.agentPerformance || []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No staff yet</p>
            ) : (
              <div className="space-y-1">
                {(data?.agentPerformance || []).map((agent) => {
                  const count = agent._count?.assignedApplications || 0;
                  const max = Math.max(...(data?.agentPerformance || []).map((a) => a._count?.assignedApplications || 0), 1);
                  return (
                    <div key={agent.id} className="space-y-1 rounded-lg px-2 py-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{agent.firstName} {agent.lastName}</span>
                        <span className="text-muted-foreground">{count} apps</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
