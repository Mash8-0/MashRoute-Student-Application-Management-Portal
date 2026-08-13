import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Loader2, Users, FileText, Building2, AlertTriangle, CheckCircle } from 'lucide-react';
import { tenantAPI } from '../../api/endpoints';
import { toast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../lib/utils';

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);

  const fetchTenant = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantAPI.get(id);
      setTenant(res.data.data);
    } catch {
      toast.error('Tenant not found');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  const handleSuspend = async () => {
    if (!confirm(`Suspend ${tenant.name}? All their users will lose access.`)) return;
    setActioning(true);
    try {
      await tenantAPI.suspend(id);
      toast.success('Tenant suspended');
      fetchTenant();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to suspend tenant');
    } finally {
      setActioning(false);
    }
  };

  const handleActivate = async () => {
    setActioning(true);
    try {
      await tenantAPI.activate(id);
      toast.success('Tenant activated');
      fetchTenant();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate tenant');
    } finally {
      setActioning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`PERMANENTLY DELETE ${tenant.name}? This cannot be undone and will delete ALL their data.`)) return;
    if (!confirm('Are you absolutely sure? Type-check: this deletes all students, applications, payments, and users for this tenant.')) return;
    setActioning(true);
    try {
      await tenantAPI.delete(id);
      toast.success('Tenant deleted');
      navigate('/super-admin/tenants');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete tenant');
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) return null;

  const stats = [
    { icon: Users, label: 'Users', value: tenant._count?.users ?? 0 },
    { icon: Users, label: 'Students', value: tenant._count?.students ?? 0 },
    { icon: FileText, label: 'Applications', value: tenant._count?.applications ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          {tenant.name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{tenant.name}</h1>
            <StatusBadge status={tenant.status} />
          </div>
          <p className="text-sm text-muted-foreground">{tenant.slug} · {tenant.plan} plan</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/super-admin/tenants/${id}/edit`)}>
            <Edit className="h-4 w-4" /> Edit
          </Button>
          {tenant.status === 'ACTIVE' ? (
            <Button variant="outline" size="sm" onClick={handleSuspend} disabled={actioning}
              className="border-red-200 text-red-600 hover:bg-red-50">
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Suspend
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleActivate} disabled={actioning}
              className="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-primary">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                ['Company Name', tenant.name],
                ['Slug', tenant.slug],
                ['Email', tenant.email],
                ['Phone', tenant.phone],
                ['Address', tenant.address],
                ['Created', formatDate(tenant.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium">{value || '—'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Plan & Limits */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  ['Plan', tenant.plan],
                  ['Status', tenant.status],
                  ['Max Users', tenant.maxUsers ?? '—'],
                  ['Max Students', tenant.maxStudents ?? '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {tenant.maxUsers && tenant._count?.users !== undefined && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">User capacity</span>
                    <span className="font-medium">{tenant._count.users} / {tenant.maxUsers}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (tenant._count.users / tenant.maxUsers) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive text-sm">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Permanently delete this tenant and all their data. This action cannot be undone.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={actioning}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Delete Tenant
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
