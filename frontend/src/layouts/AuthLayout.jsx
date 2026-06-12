import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Toaster } from '../components/ui/toast';
import ThemeToggle from '../components/common/ThemeToggle';

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Theme toggle */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-lg"
      >
        {/* Single card: logo + form together */}
        <div className="rounded-3xl border border-border bg-card px-8 py-10 shadow-premium sm:px-12 sm:py-12">
          {/* Logo */}
          <div className="mb-9 flex flex-col items-center gap-1 text-center">
            <img
              src="/logo-icon.png"
              alt="MashRoute"
              className="h-28 w-28 flex-shrink-0 object-contain"
            />
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="text-3xl font-extrabold leading-none tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF 0%, #5B7FFF 55%, #8B4FE8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                MashRoute
              </span>
              <span
                className="text-[10px] font-semibold leading-none tracking-[0.22em] uppercase"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF 0%, #5B7FFF 55%, #8B4FE8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  opacity: 0.75,
                }}
              >
                Student Application Management Portal
              </span>
            </div>
          </div>

          <Outlet />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} MashRoute. All rights reserved.
        </p>
      </motion.div>

      <Toaster />
    </div>
  );
}
