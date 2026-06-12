import { useState, useEffect } from 'react';
import { Loader2, Users, FileText, DollarSign, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { analyticsAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from '../../components/ui/toast';
import { formatCurrency, formatStatusLabel } from '../../lib/utils';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value ?? '—'}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.dashboard().then((res) => {
      setData(res.data.data);
    }).catch(() => {
      toast.error('Failed to load analytics');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const overview = data.overview || {};

  // Convert applicationsByStatus array to chart data
  const statusChartData = (data.applicationsByStatus || []).map((item) => ({
    name: formatStatusLabel(item.status),
    value: item._count?.status || 0,
    status: item.status,
  }));

  // Monthly data — count comes as string from raw SQL
  const monthlyData = (data.monthlyApplications || []).map((m) => ({
    name: m.month,
    Applications: Number(m.count),
  }));

  // Agent performance
  const agents = (data.agentPerformance || []).map((a) => ({
    name: `${a.firstName} ${a.lastName}`,
    apps: a._count?.assignedApplications || 0,
  })).sort((a, b) => b.apps - a.apps);

  const approvalRate = overview.totalApplications > 0
    ? Math.round((overview.completed / overview.totalApplications) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Application and operational insights" />

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Students" value={overview.totalStudents} />
        <StatCard icon={FileText} label="Total Applications" value={overview.totalApplications} />
        <StatCard icon={CheckCircle} label="Completed" value={overview.completed} color="text-green-600" />
        <StatCard icon={XCircle} label="Rejected" value={overview.rejected} color="text-red-500" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="Pending / Draft" value={overview.pending} color="text-yellow-600" />
        <StatCard icon={TrendingUp} label="Visa Approved" value={overview.approved} color="text-emerald-600" sub="Ready for visa" />
        <StatCard icon={DollarSign} label="Total Revenue" value={overview.totalRevenue ? formatCurrency(overview.totalRevenue) : '—'} sub={`${overview.paidInvoices || 0} invoices paid`} color="text-blue-600" />
        <StatCard icon={TrendingUp} label="Approval Rate" value={`${approvalRate}%`} sub="Completed vs total" color="text-indigo-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly bar chart */}
        {monthlyData.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Applications — Last 6 Months</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="Applications" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Status pie chart */}
        {statusChartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Applications by Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Agent performance */}
      {agents.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Staff Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agents.map((a, i) => {
                const max = agents[0]?.apps || 1;
                const pct = Math.round((a.apps / max) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <span className="ml-2 text-xs font-semibold text-primary flex-shrink-0">{a.apps} apps</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {monthlyData.length === 0 && statusChartData.length === 0 && agents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No analytics data yet. Start by adding students and creating applications.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
