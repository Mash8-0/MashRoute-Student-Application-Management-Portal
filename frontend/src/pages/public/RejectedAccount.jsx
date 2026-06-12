import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, LogOut, LifeBuoy } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api/endpoints';
import { Button } from '../../components/ui/button';
import ThemeToggle from '../../components/common/ThemeToggle';

export default function RejectedAccount() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const companyName = user?.tenant?.name;
  const reason = user?.tenant?.rejectionReason;

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
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
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-foreground">Account request rejected</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {companyName ? (
              <>
                Your account request for{' '}
                <span className="font-semibold text-foreground">{companyName}</span> has been rejected.
              </>
            ) : (
              'Your account request has been rejected.'
            )}{' '}
            Please contact support for more information.
          </p>

          {reason && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-500/80">
                Reason provided
              </p>
              <p className="mt-1 text-sm text-foreground">{reason}</p>
            </div>
          )}

          <div className="mt-7 flex flex-col items-center gap-3">
            <a href="mailto:support@mashroute.com">
              <Button className="gap-2">
                <LifeBuoy className="h-4 w-4" />
                Contact support
              </Button>
            </a>
            <Button variant="ghost" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
