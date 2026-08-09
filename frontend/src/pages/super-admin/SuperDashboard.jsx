import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, FileText, GraduationCap, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { analyticsAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
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
import { timeAgo } from '../../lib/utils';

const PLAN_COLORS = { STARTER: '#6172f3', PROFESSIONAL: '#10b981', ENTERPRISE: '#f59e0b' };

export default function SuperDashboard() {
  const navigate = useNavigate();
  const fetchGlobal = useCallback(() => analyticsAPI.global(), []);
  const { data, loading, refreshing, error, updatedAt, reload } = useDashboardData(fetchGlobal);

  const overview = data?.overview || {};
  const planData = useMemo(() => (data?.byPlan || []).map((p) => ({
    name: p.plan,
    count: p._count?.plan || 0,
    color: PLAN_COLORS[p.plan] || '#6172f3',
  })), [data?.byPlan]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Overview"
        description={updatedAt ? `Monitor tenants and platform activity · updated ${timeAgo(updatedAt)}` : 'Monitor tenants and platform activity'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton refreshing={refreshing} onClick={() => reload(true)} />
            <Button onClick={() => navigate('/super-admin/tenants')}>
              <Building2 className="h-4 w-4" />
              Manage Tenants
            </Button>
          </div>
        }
      />

      {error && !data && (
        <ErrorState title="Unable to load platform dashboard" onRetry={() => reload()} />
      )}

      <section aria-label="Platform metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Tenants" value={overview.totalTenants || 0} icon={Building2} color="primary" loading={loading} error={error && !data} subtitle={`${overview.activeTenants || 0} active`} onClick={() => navigate('/super-admin/tenants')} />
        <MetricCard title="Active Tenants" value={overview.activeTenants || 0} icon={CheckCircle2} color="success" loading={loading} error={error && !data} subtitle="approved companies" onClick={() => navigate('/super-admin/tenants?status=ACTIVE')} delay={0.03} />
        <MetricCard title="Total Users" value={overview.totalUsers || 0} icon={Users} color="info" loading={loading} error={error && !data} subtitle="platform accounts" delay={0.06} />
        <MetricCard title="Applications" value={overview.totalApplications || 0} icon={FileText} color="primary" loading={loading} error={error && !data} subtitle={`${(overview.totalStudents || 0).toLocaleString()} students`} delay={0.09} />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <SectionShell title="Tenants by Plan" description="Current subscription distribution">
          <ChartFrame loading={loading} error={error && !data} empty={planData.length === 0} emptyTitle="No tenant plans yet" height={280} onRetry={() => reload()}>
            <BarChart data={planData} barSize={42} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip {...makeTooltipProps()} />
              <Bar dataKey="count" name="Tenants" radius={[8, 8, 0, 0]}>
                {planData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ChartFrame>
          {!loading && planData.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {planData.map((plan) => (
                <div key={plan.name} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
                    <span className="truncate text-xs font-medium text-muted-foreground">{plan.name}</span>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-foreground">{plan.count}</p>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          title="Recent Tenants"
          description="Newest companies added to MashRoute"
          action={<TextLinkButton onClick={() => navigate('/super-admin/tenants')} ariaLabel="View all tenants">View all</TextLinkButton>}
          contentClassName="p-0"
        >
          {loading ? (
            <div className="p-5"><DashboardSkeleton rows={5} /></div>
          ) : (data?.recentTenants || []).length === 0 ? (
            <div className="p-5"><EmptyState title="No tenants yet" description="Approved company accounts will appear here." /></div>
          ) : (
            <div className="divide-y divide-border">
              {(data?.recentTenants || []).map((tenant) => (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => navigate(`/super-admin/tenants/${tenant.id}`)}
                  className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{tenant.name}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{tenant.plan} · {timeAgo(tenant.createdAt)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 sm:justify-end">
                    <StatusBadge status={tenant.status} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionShell>
      </div>

      <SectionShell title="Platform Scope" description="High-level totals authorized for super admins only">
        {loading ? (
          <DashboardSkeleton rows={3} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-4">
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-2xl font-semibold text-foreground">{(overview.totalStudents || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Students across tenants</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-2xl font-semibold text-foreground">{(overview.totalApplications || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Applications across tenants</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-2xl font-semibold text-foreground">{(overview.totalUsers || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Authorized user accounts</p>
            </div>
          </div>
        )}
      </SectionShell>
    </div>
  );
}
