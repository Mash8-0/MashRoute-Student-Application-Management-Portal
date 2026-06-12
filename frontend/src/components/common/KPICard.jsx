import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

// Theme-adaptive color sets. Tints use alpha over the card so they look right in
// both light and dark mode. Icon chips use a glossy gradient + colored glow.
const COLORS = {
  blue: {
    tint: 'from-blue-500/15',
    blob: 'bg-blue-500/25',
    chip: 'from-blue-400 to-blue-600 shadow-blue-500/30',
    accent: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    tint: 'from-emerald-500/15',
    blob: 'bg-emerald-500/25',
    chip: 'from-emerald-400 to-emerald-600 shadow-emerald-500/30',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
  orange: {
    tint: 'from-amber-500/15',
    blob: 'bg-amber-500/25',
    chip: 'from-amber-400 to-orange-500 shadow-amber-500/30',
    accent: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    tint: 'from-rose-500/15',
    blob: 'bg-rose-500/25',
    chip: 'from-rose-400 to-red-600 shadow-rose-500/30',
    accent: 'text-rose-600 dark:text-rose-400',
  },
  purple: {
    tint: 'from-violet-500/15',
    blob: 'bg-violet-500/25',
    chip: 'from-violet-400 to-purple-600 shadow-violet-500/30',
    accent: 'text-violet-600 dark:text-violet-400',
  },
  navy: {
    tint: 'from-indigo-500/15',
    blob: 'bg-indigo-500/25',
    chip: 'from-indigo-400 to-indigo-600 shadow-indigo-500/30',
    accent: 'text-indigo-600 dark:text-indigo-400',
  },
};

export default function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'blue', loading, onClick }) {
  const c = COLORS[color] || COLORS.blue;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-500' : 'text-muted-foreground';

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-11 w-11 rounded-xl bg-muted" />
        </div>
        <div className="mt-4 h-8 w-20 rounded bg-muted" />
        <div className="mt-2 h-3 w-32 rounded bg-muted" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-all',
        'bg-gradient-to-br to-card', c.tint,
        onClick && 'cursor-pointer hover:-translate-y-1 hover:shadow-premium hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring'
      )}
    >
      {/* Glossy top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
      {/* Colored glow blob */}
      <div className={cn('pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity group-hover:opacity-80', c.blob)} />

      <div className="relative flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/20', c.chip)}>
            <Icon className="h-5 w-5 drop-shadow-sm" />
          </div>
        )}
      </div>

      <div className="relative mt-3">
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {(subtitle || trendValue) && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {trendValue && (
              <span className={cn('flex items-center gap-0.5 text-xs font-semibold', trendColor)}>
                <TrendIcon className="h-3.5 w-3.5" />
                {trendValue}
              </span>
            )}
            {subtitle && (
              <span className={cn('text-xs font-medium', c.accent)}>{subtitle}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
