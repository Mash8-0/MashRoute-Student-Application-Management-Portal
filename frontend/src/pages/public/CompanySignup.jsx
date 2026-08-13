import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Upload, Loader2, CheckCircle2, ArrowLeft, ArrowRight,
  AlertCircle, User, FileText, Lock,
} from 'lucide-react';
import { registrationAPI } from '../../api/endpoints';
import { toast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import ThemeToggle from '../../components/common/ThemeToggle';

const schema = z
  .object({
    // 1) Company Information
    companyName: z.string().min(1, 'Company name is required'),
    companyEmail: z.string().min(1, 'Company email is required').email('Enter a valid email'),
    companyPhone: z.string().optional(),
    companyAddress: z.string().optional(),
    country: z.string().optional(),
    website: z.string().optional(),
    // 2) Contact Person
    contactPersonName: z.string().optional(),
    contactPersonEmail: z
      .string()
      .optional()
      .refine((v) => !v || z.string().email().safeParse(v).success, 'Enter a valid email'),
    contactPersonPhone: z.string().optional(),
    // 3) Verification
    verificationType: z.enum(['license', 'passport']),
    // 4) Account Owner / Login
    ownerFullName: z.string().min(1, 'Owner full name is required'),
    ownerEmail: z.string().min(1, 'Owner email is required').email('Enter a valid email'),
    ownerPhone: z.string().optional(),
    ownerPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.ownerPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const STEPS = [
  { id: 1, title: 'Company', icon: Building2 },
  { id: 2, title: 'Contact', icon: User },
  { id: 3, title: 'Documents', icon: FileText },
  { id: 4, title: 'Password', icon: Lock },
  { id: 5, title: 'Review', icon: CheckCircle2 },
];

// Fields validated before advancing past each step.
const STEP_FIELDS = {
  1: ['companyName', 'companyEmail', 'companyPhone', 'companyAddress', 'country', 'website'],
  2: ['contactPersonName', 'contactPersonEmail', 'contactPersonPhone'],
  3: ['verificationType'],
  4: ['ownerFullName', 'ownerEmail', 'ownerPhone', 'ownerPassword', 'confirmPassword'],
};

function Field({ label, error, children, required }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground/80">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function CompanySignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [verificationDoc, setVerificationDoc] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { verificationType: 'license' },
    mode: 'onTouched',
  });

  const verificationType = watch('verificationType');

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setLogoFile(null); setLogoPreview(null); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const next = async () => {
    const fields = STEP_FIELDS[step] || [];
    const ok = await trigger(fields);
    if (!ok) return;
    if (step === 3 && !verificationDoc) {
      toast.error('Please upload a verification document');
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const onSubmit = async (data) => {
    if (!verificationDoc) {
      toast.error('Please upload a verification document');
      setStep(3);
      return;
    }
    setSubmitting(true);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'confirmPassword') return;
      if (value !== undefined && value !== null && value !== '') formData.append(key, value);
    });
    formData.append('verificationDoc', verificationDoc);
    if (logoFile) formData.append('logo', logoFile);

    try {
      await registrationAPI.register(formData);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const v = getValues();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Top bar */}
        <div className="mb-5 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <ThemeToggle />
        </div>

        {/* Logo */}
        <div className="mb-7 flex items-center justify-center gap-4">
          <img src="/logo-icon.png" alt="MashRoute" className="h-16 w-16 flex-shrink-0 object-contain" />
          <div className="flex flex-col justify-center gap-1.5">
            <span
              className="text-2xl font-extrabold leading-none tracking-tight"
              style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #5B7FFF 55%, #8B4FE8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              MashRoute
            </span>
            <span
              className="text-[10px] font-semibold uppercase leading-none tracking-[0.2em]"
              style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #5B7FFF 55%, #8B4FE8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', opacity: 0.75 }}
            >
              Student Application Management Portal
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8">
          {submitted ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Request submitted successfully</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Your company account request has been submitted successfully. Please wait for Super
                Admin approval — you&apos;ll be notified once it&apos;s reviewed.
              </p>
              <Button className="mt-6" onClick={() => navigate('/login')}>Back to login</Button>
            </div>
          ) : (
            <>
              {/* Stepper */}
              <div className="mb-7 flex items-center justify-between">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done = step > s.id;
                  const active = step === s.id;
                  return (
                    <div key={s.id} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                            done
                              ? 'border-primary bg-primary text-primary-foreground'
                              : active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <span className={`text-[10px] font-medium ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {s.title}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`mx-1 h-0.5 flex-1 rounded ${done ? 'bg-primary' : 'bg-border'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* STEP 1 — Company */}
                    {step === 1 && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Company name" error={errors.companyName?.message} required>
                            <Input {...register('companyName')} placeholder="Acme Education Agency" />
                          </Field>
                        </div>
                        <Field label="Company email" error={errors.companyEmail?.message} required>
                          <Input {...register('companyEmail')} type="email" placeholder="info@company.com" />
                        </Field>
                        <Field label="Company phone" error={errors.companyPhone?.message}>
                          <Input {...register('companyPhone')} placeholder="+1 555 000 0000" />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Company address" error={errors.companyAddress?.message}>
                            <Input {...register('companyAddress')} placeholder="123 Main St, Suite 100" />
                          </Field>
                        </div>
                        <Field label="Country" error={errors.country?.message}>
                          <Input {...register('country')} placeholder="e.g. United Arab Emirates" />
                        </Field>
                        <Field label="Website / Facebook page" error={errors.website?.message}>
                          <Input {...register('website')} placeholder="https://company.com" />
                        </Field>
                      </div>
                    )}

                    {/* STEP 2 — Contact person */}
                    {step === 2 && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Contact person name" error={errors.contactPersonName?.message}>
                            <Input {...register('contactPersonName')} placeholder="Jane Doe" />
                          </Field>
                        </div>
                        <Field label="Contact person email" error={errors.contactPersonEmail?.message}>
                          <Input {...register('contactPersonEmail')} type="email" placeholder="jane@company.com" />
                        </Field>
                        <Field label="Contact person phone" error={errors.contactPersonPhone?.message}>
                          <Input {...register('contactPersonPhone')} placeholder="+1 555 000 0000" />
                        </Field>
                      </div>
                    )}

                    {/* STEP 3 — Documents */}
                    {step === 3 && (
                      <div className="space-y-4">
                        <div>
                          <p className="mb-2 text-sm font-medium text-foreground/80">Document type</p>
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
                                <input type="radio" value={opt.value} {...register('verificationType')} className="h-4 w-4 accent-primary" />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                          <p className="text-xs text-muted-foreground">
                            If you do not have a company license, you may submit your passport copy for manual verification.
                          </p>
                        </div>

                        <div>
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                            <Upload className="h-4 w-4" />
                            {verificationDoc ? 'Change document' : 'Upload verification document'}
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setVerificationDoc(e.target.files?.[0] || null)} />
                          </label>
                          {verificationDoc && (
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-500">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {verificationDoc.name}
                            </p>
                          )}
                        </div>

                        <div className="border-t border-border pt-4">
                          <p className="mb-2 text-sm font-medium text-foreground/80">
                            Company logo <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                          </p>
                          <div className="flex items-center gap-5">
                            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40">
                              {logoPreview ? <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" /> : <Building2 className="h-7 w-7 text-muted-foreground/50" />}
                            </div>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground">
                              <Upload className="h-4 w-4" />
                              {logoFile ? 'Change logo' : 'Upload logo'}
                              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 4 — Login password */}
                    {step === 4 && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Owner full name" error={errors.ownerFullName?.message} required>
                          <Input {...register('ownerFullName')} placeholder="John Smith" />
                        </Field>
                        <Field label="Owner email (login)" error={errors.ownerEmail?.message} required>
                          <Input {...register('ownerEmail')} type="email" placeholder="owner@company.com" autoComplete="email" />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Owner phone" error={errors.ownerPhone?.message}>
                            <Input {...register('ownerPhone')} placeholder="+1 555 000 0000" />
                          </Field>
                        </div>
                        <Field label="Password" error={errors.ownerPassword?.message} required>
                          <Input {...register('ownerPassword')} type="password" placeholder="••••••••" autoComplete="new-password" />
                        </Field>
                        <Field label="Confirm password" error={errors.confirmPassword?.message} required>
                          <Input {...register('confirmPassword')} type="password" placeholder="••••••••" autoComplete="new-password" />
                        </Field>
                      </div>
                    )}

                    {/* STEP 5 — Review */}
                    {step === 5 && (
                      <div className="space-y-4">
                        <h3 className="text-base font-semibold text-foreground">Review & submit</h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {[
                            ['Company', v.companyName],
                            ['Company email', v.companyEmail],
                            ['Phone', v.companyPhone],
                            ['Country', v.country],
                            ['Contact person', v.contactPersonName],
                            ['Owner / login', v.ownerEmail],
                            ['Verification', verificationType],
                            ['Document', verificationDoc?.name],
                            ['Logo', logoFile?.name || 'Not provided'],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</p>
                              <p className="truncate text-sm font-medium text-foreground">{value || '—'}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <p className="text-xs text-muted-foreground">
                            After submitting, your account stays in <span className="font-semibold text-foreground">Pending Approval</span> until a Super Admin reviews it.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Nav buttons */}
                <div className="mt-8 flex items-center justify-between gap-3">
                  <Button type="button" variant="ghost" onClick={back} disabled={step === 1} className="gap-1.5">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  {step < 5 ? (
                    <Button type="button" onClick={next} className="gap-1.5">
                      Next <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting} className="gap-1.5">
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : 'Submit for approval'}
                    </Button>
                  )}
                </div>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary transition-colors hover:text-primary/80">Sign in</Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} MashRoute. All rights reserved.
        </p>
      </div>
    </div>
  );
}
