import { useState, useEffect } from 'react';
import { Building2, Users, GraduationCap, FileText, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { analyticsAPI } from '../../api/endpoints';
import KPICard from '../../components/common/KPICard';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import StatusBadge from '../../components/common/StatusBadge';
import { timeAgo } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';

const PLAN_COLORS = { STARTER: '#6172f3', PROFESSIONAL: '#10b981', ENTERPRISE: '#f59e0b' };

export default function SuperDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    analyticsAPI.global()
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const overview = data?.overview || {};
  const planData = (data?.byPlan || []).map((p) => ({
    name: p.plan,
    count: p._count.plan,
    color: PLAN_COLORS[p.plan] || '#6172f3',
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Monitor all tenants and platform health"
        actions={
          <Button onClick={() => navigate('/super-admin/tenants')}>
            Manage Tenants
          </Button>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Tenants"
          value={loading ? '—' : overview.totalTenants?.toLocaleString()}
          icon={Building2}
          color="navy"
          loading={loading}
          subtitle={`${overview.activeTenants || 0} active`}
        />
        <KPICard
          title="Total Users"
          value={loading ? '—' : overview.totalUsers?.toLocaleString()}
          icon={Users}
          color="blue"
          loading={loading}
        />
        <KPICard
          title="Total Students"
          value={loading ? '—' : overview.totalStudents?.toLocaleString()}
          icon={GraduationCap}
          color="green"
          loading={loading}
        />
        <KPICard
          title="Applications"
          value={loading ? '—' : overview.totalApplications?.toLocaleString()}
          icon={FileText}
          color="purple"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Plan distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tenants by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {planData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={planData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Bar dataKey="count" name="Tenants" radius={[4, 4, 0, 0]}>
                    {planData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No tenants yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Tenants</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/tenants')}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (data?.recentTenants || []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No tenants yet</p>
            ) : (
              <div className="divide-y divide-border">
                {(data?.recentTenants || []).map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/super-admin/tenants/${tenant.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.plan} · {timeAgo(tenant.createdAt)}</p>
                    </div>
                    <StatusBadge status={tenant.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
