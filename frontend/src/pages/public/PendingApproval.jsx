import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, LogOut, MailCheck, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api/endpoints';
import { Button } from '../../components/ui/button';
import ThemeToggle from '../../components/common/ThemeToggle';

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const companyName = user?.tenant?.name;

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-lg"
      >
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src="/logo-icon.png" alt="MashRoute" className="h-10 w-10 object-contain" />
          <span
            className="text-xl font-extrabold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #00D4FF 0%, #5B7FFF 55%, #8B4FE8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            MashRoute
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-premium">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
            <Clock className="h-8 w-8 text-amber-500" />
          </div>

          <h1 className="text-2xl font-bold text-foreground">Waiting for approval</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {companyName ? (
              <>
                Your account for <span className="font-semibold text-foreground">{companyName}</span> is
                waiting for Super Admin approval.
              </>
            ) : (
              'Your account is waiting for Super Admin approval.'
            )}{' '}
            You&apos;ll be able to access your dashboard as soon as it&apos;s approved.
          </p>

          <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                Our team is reviewing your company details and verification documents.
              </p>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
              <MailCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                You&apos;ll receive a notification once your account is approved.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-col items-center gap-3">
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <p className="text-xs text-muted-foreground">
              Need help? Contact{' '}
              <a href="mailto:support@mashroute.com" className="text-primary hover:underline">
                support@mashroute.com
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
