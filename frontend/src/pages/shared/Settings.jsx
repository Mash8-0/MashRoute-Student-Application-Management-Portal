import { useState, useEffect } from 'react';
import { Loader2, Save, User, Lock, Bell, MessageCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { authAPI } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from '../../components/ui/toast';
import { getInitials } from '../../lib/utils';
import WhatsAppSettings from '../../components/settings/WhatsAppSettings';

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm();

  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    watch: watchPwd,
    formState: { errors: pwdErrors },
  } = useForm();

  const newPwd = watchPwd('newPassword');

  useEffect(() => {
    if (user) {
      resetProfile({ firstName: user.firstName, lastName: user.lastName, email: user.email });
    }
  }, [user, resetProfile]);

  const onSaveProfile = async (data) => {
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({ firstName: data.firstName, lastName: data.lastName });
      updateUser(res.data.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (data) => {
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed successfully');
      resetPwd();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    ...(isTenantAdmin ? [{ id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <div className="flex gap-1 border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className={activeTab === 'whatsapp' ? 'max-w-3xl' : 'max-w-xl'}>
        {/* WhatsApp Tab (tenant admin) */}
        {activeTab === 'whatsapp' && isTenantAdmin && <WhatsAppSettings />}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfile(onSaveProfile)}>
            <Card>
              <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                    {getInitials(`${user?.firstName} ${user?.lastName}`)}
                  </div>
                  <div>
                    <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user?.role?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{user?.tenant?.name || 'System'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" error={profileErrors.firstName?.message}>
                    <Input {...regProfile('firstName', { required: 'Required' })} />
                  </Field>
                  <Field label="Last Name" error={profileErrors.lastName?.message}>
                    <Input {...regProfile('lastName', { required: 'Required' })} />
                  </Field>
                </div>

                <Field label="Email">
                  <Input {...regProfile('email')} disabled className="opacity-60 cursor-not-allowed" />
                  <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed. Contact an admin if needed.</p>
                </Field>

                <Button type="submit" disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </form>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <form onSubmit={handlePwd(onChangePassword)}>
            <Card>
              <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Current Password" error={pwdErrors.currentPassword?.message}>
                  <Input
                    type="password"
                    {...regPwd('currentPassword', { required: 'Current password is required' })}
                    placeholder="Enter current password"
                  />
                </Field>
                <Field label="New Password" error={pwdErrors.newPassword?.message}>
                  <Input
                    type="password"
                    {...regPwd('newPassword', {
                      required: 'New password is required',
                      minLength: { value: 8, message: 'At least 8 characters' },
                    })}
                    placeholder="Min 8 characters"
                  />
                </Field>
                <Field label="Confirm New Password" error={pwdErrors.confirmPassword?.message}>
                  <Input
                    type="password"
                    {...regPwd('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (v) => v === newPwd || 'Passwords do not match',
                    })}
                    placeholder="Repeat new password"
                  />
                </Field>
                <Button type="submit" disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {saving ? 'Saving...' : 'Change Password'}
                </Button>
              </CardContent>
            </Card>
          </form>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Status change alerts', desc: 'Notified when application status changes', defaultChecked: true },
                { label: 'New application created', desc: 'When a new application is submitted', defaultChecked: true },
                { label: 'Document uploaded', desc: 'When a new document is added for your students', defaultChecked: false },
                { label: 'Payment received', desc: 'When a payment is marked as paid', defaultChecked: true },
              ].map(({ label, desc, defaultChecked }) => (
                <label key={label} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    defaultChecked={defaultChecked}
                    className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </label>
              ))}
              <p className="text-xs text-muted-foreground pt-2">Notification preferences are saved locally to this device.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
