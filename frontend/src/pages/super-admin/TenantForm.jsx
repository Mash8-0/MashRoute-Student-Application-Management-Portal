import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Upload, Building2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { tenantAPI } from '../../api/endpoints';
import { toast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const schema = z.object({
  name: z.string().min(2, 'Company name is required'),
  slug: z.string().min(2, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Lowercase, numbers, and hyphens only'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
  plan: z.string().optional(),
  maxUsers: z.string().optional(),
  maxStudents: z.string().optional(),
  contactPersonName: z.string().optional(),
  contactPersonEmail: z.string().email('Valid email required').optional().or(z.literal('')),
  contactPersonPhone: z.string().optional(),
  adminFirstName: z.string().optional(),
  adminLastName: z.string().optional(),
  adminEmail: z.string().email('Valid admin email required').optional().or(z.literal('')),
  adminPassword: z.string().optional(),
});

function Field({ label, error, children, required, hint }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const specials = '!@#$%&*';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out + specials[Math.floor(Math.random() * specials.length)] + Math.floor(Math.random() * 90 + 10);
}

export default function TenantForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // File + verification state (create only)
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [verificationDoc, setVerificationDoc] = useState(null);
  const [verificationType, setVerificationType] = useState('license');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { plan: 'STARTER', maxUsers: '10', maxStudents: '500' },
  });

  const nameValue = watch('name');

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEdit && nameValue) {
      setValue('slug', nameValue.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  }, [nameValue, isEdit, setValue]);

  useEffect(() => {
    if (!isEdit) return;
    tenantAPI.get(id).then((res) => {
      const t = res.data.data;
      reset({
        name: t.name,
        slug: t.slug,
        email: t.email,
        phone: t.phone || '',
        address: t.address || '',
        country: t.country || '',
        website: t.website || '',
        plan: t.plan || 'STARTER',
        maxUsers: t.maxUsers?.toString() || '10',
        maxStudents: t.maxStudents?.toString() || '500',
        contactPersonName: t.contactPersonName || '',
        contactPersonEmail: t.contactPersonEmail || '',
        contactPersonPhone: t.contactPersonPhone || '',
      });
      setLoading(false);
    }).catch(() => {
      toast.error('Tenant not found');
      navigate(-1);
    });
  }, [id, isEdit, reset, navigate]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setLogoFile(null); setLogoPreview(null); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleGeneratePassword = () => {
    const pw = genPassword();
    setValue('adminPassword', pw);
    toast.success('Temporary password generated');
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      if (isEdit) {
        await tenantAPI.update(id, {
          name: data.name,
          phone: data.phone || undefined,
          address: data.address || undefined,
          country: data.country || undefined,
          website: data.website || undefined,
          plan: data.plan,
          maxUsers: data.maxUsers ? parseInt(data.maxUsers) : undefined,
          maxStudents: data.maxStudents ? parseInt(data.maxStudents) : undefined,
          contactPersonName: data.contactPersonName || undefined,
          contactPersonEmail: data.contactPersonEmail || undefined,
          contactPersonPhone: data.contactPersonPhone || undefined,
        });
        toast.success('Tenant updated');
        navigate(`/super-admin/tenants/${id}`);
        return;
      }

      // Create — multipart so logo + verification doc upload to Drive.
      const fd = new FormData();
      const flat = {
        name: data.name,
        slug: data.slug,
        email: data.email,
        phone: data.phone,
        address: data.address,
        country: data.country,
        website: data.website,
        plan: data.plan,
        maxUsers: data.maxUsers,
        maxStudents: data.maxStudents,
        contactPersonName: data.contactPersonName,
        contactPersonEmail: data.contactPersonEmail,
        contactPersonPhone: data.contactPersonPhone,
        verificationType,
        adminFirstName: data.adminFirstName,
        adminLastName: data.adminLastName,
        // Falls back to company email on the server if blank.
        adminEmail: data.adminEmail || data.email,
        adminPassword: data.adminPassword,
      };
      Object.entries(flat).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, v);
      });
      if (logoFile) fd.append('logo', logoFile);
      if (verificationDoc) fd.append('verificationDoc', verificationDoc);

      const res = await tenantAPI.create(fd);
      toast.success('Company created — login is active immediately');
      navigate(`/super-admin/tenants/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save tenant');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{isEdit ? 'Edit Tenant' : 'Create Company / Tenant'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update tenant details and plan' : 'Create a company account — approved & active immediately'}
          </p>
        </div>
        <Button type="submit" disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : isEdit ? 'Update Tenant' : 'Create Company'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Company info */}
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Company Name" error={errors.name?.message} required>
                  <Input {...register('name')} placeholder="e.g. Bright Future Consultancy" />
                </Field>
                <Field label="Slug" error={errors.slug?.message} required hint="Unique URL identifier for this tenant">
                  <Input {...register('slug')} placeholder="e.g. bright-future" />
                </Field>
                <Field label="Company Email" error={errors.email?.message} required>
                  <Input type="email" {...register('email')} placeholder="info@agency.com" />
                </Field>
                <Field label="Phone" error={errors.phone?.message}>
                  <Input {...register('phone')} placeholder="+880 1xxx-xxxxxx" />
                </Field>
                <Field label="Country" error={errors.country?.message}>
                  <Input {...register('country')} placeholder="e.g. Bangladesh" />
                </Field>
                <Field label="Website" error={errors.website?.message}>
                  <Input {...register('website')} placeholder="https://agency.com" />
                </Field>
              </div>
              <Field label="Address" error={errors.address?.message}>
                <Input {...register('address')} placeholder="Full company address" />
              </Field>
            </CardContent>
          </Card>

          {/* Contact person */}
          <Card>
            <CardHeader><CardTitle>Contact Person</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Name" error={errors.contactPersonName?.message}>
                <Input {...register('contactPersonName')} placeholder="Jane Doe" />
              </Field>
              <Field label="Email" error={errors.contactPersonEmail?.message}>
                <Input type="email" {...register('contactPersonEmail')} placeholder="jane@agency.com" />
              </Field>
              <Field label="Phone" error={errors.contactPersonPhone?.message}>
                <Input {...register('contactPersonPhone')} placeholder="+880 1xxx-xxxxxx" />
              </Field>
            </CardContent>
          </Card>

          {/* Verification + Logo (create only) */}
          {!isEdit && (
            <Card>
              <CardHeader><CardTitle>Verification & Branding</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium">Verification document type</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ value: 'license', label: 'Company License' }, { value: 'passport', label: 'Passport' }].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors ${
                          verificationType === opt.value
                            ? 'border-primary/60 bg-primary/10 text-foreground'
                            : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="verificationType"
                          value={opt.value}
                          checked={verificationType === opt.value}
                          onChange={() => setVerificationType(opt.value)}
                          className="h-4 w-4 accent-primary"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                    <Upload className="h-4 w-4" />
                    {verificationDoc ? 'Change document' : 'Upload license / passport copy'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setVerificationDoc(e.target.files?.[0] || null)}
                    />
                  </label>
                  {verificationDoc && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {verificationDoc.name}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-7 w-7 text-muted-foreground/50" />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground">
                    <Upload className="h-4 w-4" />
                    {logoFile ? 'Change logo' : 'Upload company logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin account (create only) */}
          {!isEdit && (
            <Card>
              <CardHeader><CardTitle>Initial Admin Account</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  This becomes the tenant's login and is active immediately. If you leave the email
                  blank, the company email is used; if you leave the password blank, it defaults to
                  <span className="font-mono"> Admin@123!</span>.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Admin First Name" error={errors.adminFirstName?.message}>
                    <Input {...register('adminFirstName')} placeholder="First" />
                  </Field>
                  <Field label="Admin Last Name" error={errors.adminLastName?.message}>
                    <Input {...register('adminLastName')} placeholder="Last" />
                  </Field>
                  <Field label="Admin Email" error={errors.adminEmail?.message}>
                    <Input type="email" {...register('adminEmail')} placeholder="admin@tenant.com" />
                  </Field>
                  <Field label="Admin Password" error={errors.adminPassword?.message}>
                    <div className="flex gap-2">
                      <Input type="text" {...register('adminPassword')} placeholder="Min 8 characters" />
                      <Button type="button" variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" title="Generate temporary password" onClick={handleGeneratePassword}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </Field>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Plan */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Subscription Plan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Plan" error={errors.plan?.message}>
                <select {...register('plan')} className={selectClass}>
                  <option value="STARTER">Starter</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </Field>
              <Field label="Max Users" error={errors.maxUsers?.message}>
                <Input type="number" {...register('maxUsers')} placeholder="10" min="1" />
              </Field>
              <Field label="Max Students" error={errors.maxStudents?.message}>
                <Input type="number" {...register('maxStudents')} placeholder="500" min="1" />
              </Field>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : isEdit ? 'Update Tenant' : 'Create Company'}
          </Button>
        </div>
      </div>
    </form>
  );
}
