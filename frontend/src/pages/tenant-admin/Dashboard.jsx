import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Clock, CreditCard, FileText,
  GraduationCap, PlaneLanding, Plus, UserPlus, Users,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { analyticsAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import CompanyBrand from '../../components/common/CompanyBrand';
import StatusBadge from '../../components/common/StatusBadge';
import { Button } from '../../components/ui/button';
import {
  ChartFrame,
  DashboardSkeleton,
  EmptyState,
  ErrorState,
  MetricCard,
  RefreshButton,
  SectionShell,
  TextLinkButton,
  makeTooltipProps,
  useDashboardData,
} from '../../components/dashboard/DashboardWidgets';
import { useAuthStore } from '../../store/authStore';
import { APPLICATION_STATUSES, formatCurrency, formatStatusLabel, timeAgo } from '../../lib/utils';

const CHART_COLORS = ['#6172f3', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#14b8a6', '#84cc16'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel() {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fetchDashboard = useCallback(() => analyticsAPI.dashboard(), []);
  const { data, loading, refreshing, error, updatedAt, reload } = useDashboardData(fetchDashboard);

  const overview = data?.overview || {};
  const monthlyData = Array.isArray(data?.monthlyApplications) ? data.monthlyApplications : [];
  const applicationsByStatus = Array.isArray(data?.applicationsByStatus) ? data.applicationsByStatus : [];
  const totalApplications = overview.totalApplications || 0;
  const isStaff = user?.role === 'STAFF';

  const statusData = useMemo(() => applicationsByStatus.map((s, i) => ({
    name: formatStatusLabel(s.status),
    status: s.status,
    value: s._count?.status || 0,
    color: CHART_COLORS[i % CHART_COLORS.length],
  })), [applicationsByStatus]);

  const pipeline = useMemo(() => {
    const countByStatus = applicationsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count?.status || 0;
      return acc;
    }, {});
    return APPLICATION_STATUSES.map((status, index) => ({
      status,
      label: formatStatusLabel(status),
      count: countByStatus[status] || 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
      percentage: pct(countByStatus[status] || 0, totalApplications),
    }));
  }, [applicationsByStatus, totalApplications]);

  const mdacItems = [
    { label: 'Eligible now', value: data?.mdacActionRequired?.eligibleNow || 0, filter: 'eligible_now', tone: 'info' },
    { label: 'Due tomorrow', value: data?.mdacActionRequired?.dueTomorrow || 0, filter: 'due_tomorrow', tone: 'warning' },
    { label: 'Due today', value: data?.mdacActionRequired?.dueToday || 0, filter: 'due_today', tone: 'danger' },
    { label: 'Unverified', value: data?.mdacActionRequired?.submittedUnverified || 0, filter: 'submitted_unverified', tone: 'primary' },
    { label: 'Needs review', value: data?.mdacActionRequired?.needsReview || 0, filter: 'needs_review', tone: 'warning' },
    { label: 'Overdue', value: data?.mdacActionRequired?.overdue || 0, filter: 'overdue', tone: 'danger' },
  ];

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const greetName = user?.role === 'TENANT_ADMIN' ? (user?.tenant?.name || fullName) : fullName;
  const showTenantLogo = user?.role === 'TENANT_ADMIN' && user?.tenant;

  const goStatus = (status) => navigate(`/applications?status=${status}`);
  const goMdac = (mdac) => navigate(`/applications?mdac=${mdac}`);

  return (
    <div className="space-y-5">
      <PageHeader
        leading={showTenantLogo && (
          <CompanyBrand name={user.tenant.name} logo={user.tenant.logo} size="xl" showName={false} />
        )}
        title={`${greeting()}${greetName ? `, ${greetName}` : ''}`}
        description={
          updatedAt
            ? `${isStaff ? 'Your assigned application overview' : 'Tenant application management overview'} · updated ${timeAgo(updatedAt)}`
            : `${isStaff ? 'Your assigned application overview' : 'Tenant application management overview'} · ${todayLabel()}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton refreshing={refreshing} onClick={() => reload(true)} />
            <Button variant="outline" size="sm" onClick={() => navigate('/students/new')}>
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Student</span>
            </Button>
            <Button size="sm" onClick={() => navigate('/applications/new')}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Application</span>
            </Button>
          </div>
        }
      />

      {error && !data && (
        <ErrorState title="Unable to load dashboard metrics" onRetry={() => reload()} />
      )}

      <section aria-label="Dashboard metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Students" value={overview.totalStudents || 0} icon={GraduationCap} color="primary" loading={loading} error={error && !data} subtitle={isStaff ? 'linked to assigned applications' : 'registered students'} onClick={() => navigate('/students')} />
        <MetricCard title="Applications" value={totalApplications} icon={FileText} color="info" loading={loading} error={error && !data} subtitle="active records in scope" onClick={() => navigate('/applications')} delay={0.03} />
        <MetricCard title="Approved" value={overview.approved || 0} icon={CheckCircle2} color="success" loading={loading} error={error && !data} subtitle="visa approvals" onClick={() => goStatus('VISA_APPROVED')} delay={0.06} />
        <MetricCard title="Revenue" value={overview.totalRevenue || 0} icon={CreditCard} color="primary" loading={loading} error={error && !data} subtitle={`${overview.paidInvoices || 0} paid invoices`} format={(v) => formatCurrency(v)} onClick={() => navigate('/payments')} delay={0.09} />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <SectionShell
          title="Application Pipeline"
          description="Current distribution across the active workflow"
          action={<TextLinkButton onClick={() => navigate('/applications')} ariaLabel="View all applications">View all</TextLinkButton>}
        >
          {loading ? (
            <DashboardSkeleton rows={5} />
          ) : pipeline.every((stage) => stage.count === 0) ? (
            <EmptyState title="No applications in the pipeline" description="New applications will appear here as they move through the workflow." />
          ) : (
            <div className="space-y-3">
              {pipeline.map((stage) => (
                <button
                  key={stage.status}
                  type="button"
                  onClick={() => goStatus(stage.status)}
                  className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-all hover:border-border hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground">{stage.label}</span>
                      <span className="text-xs text-muted-foreground">{stage.percentage}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none"
                        style={{ width: `${stage.percentage}%`, backgroundColor: stage.color }}
                      />
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">{stage.count}</span>
                </button>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          title="Action Required"
          description="MDAC reminders that need attention"
          action={<PlaneLanding className="h-4 w-4 text-primary" aria-hidden="true" />}
        >
          {loading ? (
            <DashboardSkeleton rows={6} />
          ) : mdacItems.every((item) => item.value === 0) ? (
            <EmptyState title="No MDAC action needed" description="Upcoming arrival reminders will appear here when they enter the submission window." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {mdacItems.map((item) => (
                <button
                  key={item.filter}
                  type="button"
                  onClick={() => goMdac(item.filter)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>
                    <span className="block text-sm font-medium text-foreground">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Open filtered records</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {(item.tone === 'danger' || item.tone === 'warning') && <AlertTriangle className={item.tone === 'danger' ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-amber-600'} aria-hidden="true" />}
                    <span className="text-xl font-semibold text-foreground">{item.value}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionShell>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionShell title="Applications Over Time" description="Monthly application volume" className="lg:col-span-2">
          <ChartFrame loading={loading} error={error && !data} empty={monthlyData.length === 0} emptyTitle="No monthly trend yet" onRetry={() => reload()}>
            <AreaChart data={monthlyData} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboardApplications" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6172f3" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#6172f3" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip {...makeTooltipProps()} />
              <Area type="monotone" dataKey="count" name="Applications" stroke="#6172f3" strokeWidth={2.5} fill="url(#dashboardApplications)" activeDot={{ r: 4 }} />
            </AreaChart>
          </ChartFrame>
        </SectionShell>

        <SectionShell title="Status Mix" description="Share of applications by status">
          <ChartFrame loading={loading} error={error && !data} empty={statusData.length === 0} emptyTitle="No status data yet">
            <PieChart>
              <Pie data={statusData} cx="50%" cy="44%" innerRadius={54} outerRadius={82} paddingAngle={3} dataKey="value" onClick={(entry) => entry?.status && goStatus(entry.status)} className="cursor-pointer focus:outline-none">
                {statusData.map((entry) => <Cell key={entry.status} fill={entry.color} className="cursor-pointer" />)}
              </Pie>
              <Tooltip {...makeTooltipProps()} />
            </PieChart>
          </ChartFrame>
          {!loading && statusData.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {statusData.slice(0, 5).map((item) => (
                <button key={item.status} type="button" onClick={() => goStatus(item.status)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="text-xs font-semibold text-foreground">{item.value}</span>
                </button>
              ))}
            </div>
          )}
        </SectionShell>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionShell
          title="Recent Applications"
          description="Latest submitted or updated records"
          action={<TextLinkButton onClick={() => navigate('/applications')} ariaLabel="View all recent applications">View all</TextLinkButton>}
          contentClassName="p-0"
        >
          {loading ? (
            <div className="p-5"><DashboardSkeleton rows={5} /></div>
          ) : (data?.recentApplications || []).length === 0 ? (
            <div className="p-5"><EmptyState title="No applications yet" description="Create an application to start building the dashboard timeline." /></div>
          ) : (
            <div className="divide-y divide-border">
              {(data?.recentApplications || []).map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => navigate(`/applications/${app.id}`)}
                  className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{app.student?.fullName || 'Unnamed student'}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{app.university?.name || 'University not set'} · {app.referenceNo}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <StatusBadge status={app.status} />
                    <span className="text-xs text-muted-foreground sm:mt-1 sm:block">{timeAgo(app.createdAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          title={isStaff ? 'Personal Focus' : 'Staff Workload'}
          description={isStaff ? 'Quick summary for your assigned records' : 'Assigned application volume by staff member'}
          action={!isStaff && <TextLinkButton onClick={() => navigate('/users')} ariaLabel="Manage staff">Manage staff</TextLinkButton>}
        >
          {loading ? (
            <DashboardSkeleton rows={5} />
          ) : isStaff ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <MetricCard title="Pending" value={overview.pending || 0} icon={Clock} color="warning" onClick={() => goStatus('DRAFT')} />
              <MetricCard title="Completed" value={overview.completed || 0} icon={CheckCircle2} color="success" onClick={() => goStatus('COMPLETED')} />
              <MetricCard title="Rejected" value={overview.rejected || 0} icon={AlertTriangle} color="danger" onClick={() => goStatus('REJECTED')} />
            </div>
          ) : (data?.agentPerformance || []).length === 0 ? (
            <EmptyState title="No staff workload yet" description="Assigned application counts appear after staff members receive applications." />
          ) : (
            <div className="space-y-3">
              {(data?.agentPerformance || []).map((agent) => {
                const count = agent._count?.assignedApplications || 0;
                const max = Math.max(...(data?.agentPerformance || []).map((a) => a._count?.assignedApplications || 0), 1);
                return (
                  <div key={agent.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{agent.firstName} {agent.lastName}</span>
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">{count} apps</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all duration-500 motion-reduce:transition-none" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionShell>
      </div>
    </div>
  );
}
