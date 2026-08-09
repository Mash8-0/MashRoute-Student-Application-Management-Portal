import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { ResponsiveContainer } from 'recharts';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

export const dashboardMotion = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

export function CountUp({ value, format = (v) => v.toLocaleString(), className }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(Number(value) || 0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const target = Number(value) || 0;
    if (reduceMotion || hasAnimated.current) {
      setDisplay(target);
      hasAnimated.current = true;
      return undefined;
    }

    hasAnimated.current = true;
    const duration = 520;
    const start = performance.now();
    let frame = 0;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduceMotion]);

  return <span className={className}>{format(display)}</span>;
}

export function SectionShell({ title, description, action, children, className, contentClassName }) {
  return (
    <Card className={cn('overflow-hidden rounded-2xl border-border/80 shadow-card transition-shadow hover:shadow-card-hover', className)}>
      <CardHeader className="flex flex-col gap-3 border-b border-border/70 bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold sm:text-base">{title}</CardTitle>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn('p-4 sm:p-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function DashboardSkeleton({ rows = 4, className }) {
  return (
    <div className={cn('space-y-3', className)} aria-label="Loading dashboard data">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 rounded-xl bg-muted/80 animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Unable to load this section', onRetry }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center">
      <AlertCircle className="h-5 w-5 text-destructive" />
      <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">The rest of the dashboard remains available.</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function RefreshButton({ refreshing, onClick }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={refreshing} aria-label="Refresh dashboard data">
      {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Refresh
    </Button>
  );
}

export function MetricCard({ title, value, icon: Icon, subtitle, color = 'primary', loading, error, onClick, delay = 0, format }) {
  const reduceMotion = useReducedMotion();
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  const accents = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    info: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  };

  if (loading) {
    return (
      <div className="min-h-36 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-start justify-between">
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
          <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
        </div>
        <div className="mt-5 h-8 w-24 rounded bg-muted animate-pulse" />
        <div className="mt-3 h-3 w-36 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  const Comp = onClick ? 'button' : 'div';

  return (
    <motion.div
      variants={dashboardMotion}
      initial={reduceMotion ? false : 'hidden'}
      animate="show"
      transition={{ delay: reduceMotion ? 0 : delay }}
    >
      <Comp
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'group flex min-h-36 w-full flex-col justify-between rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all duration-200',
          onClick && 'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {error && <p className="mt-1 text-xs text-destructive">Unavailable</p>}
          </div>
          {Icon && (
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105', accents[color] || accents.primary)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
        </div>
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {error ? '—' : isNumber ? <CountUp value={value} format={format} /> : value}
          </p>
          {subtitle && <p className="mt-1 text-xs font-medium text-muted-foreground">{subtitle}</p>}
        </div>
      </Comp>
    </motion.div>
  );
}

export function ChartFrame({ loading, error, empty, emptyTitle, children, height = 260, onRetry }) {
  if (loading) return <DashboardSkeleton rows={1} className="[&>div]:h-64" />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (empty) return <EmptyState title={emptyTitle || 'No data yet'} description="This chart will populate as records are added." />;

  return (
    <motion.div variants={dashboardMotion} initial="hidden" animate="show" className="h-full">
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </motion.div>
  );
}

export function TextLinkButton({ children, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  );
}

export function makeTooltipProps() {
  return {
    cursor: { fill: 'hsl(var(--muted) / 0.45)' },
    contentStyle: {
      borderRadius: 12,
      border: '1px solid hsl(var(--border))',
      background: 'hsl(var(--card))',
      color: 'hsl(var(--card-foreground))',
      boxShadow: '0 8px 24px -8px rgb(15 23 42 / 0.18)',
    },
    labelStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 12 },
  };
}

export function useDashboardData(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useMemo(() => async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res.data.data);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetcher]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, refreshing, error, updatedAt, reload: load };
}
