import { Sun, Moon } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { cn } from '../../lib/utils';

/**
 * Standalone light/dark theme toggle for pages without the app Navbar
 * (public landing & company signup). Shares the same uiStore state, so the
 * choice persists across the whole app.
 */
export default function ThemeToggle({ className }) {
  const { darkMode, toggleDarkMode } = useUIStore();

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground/70 transition-colors hover:bg-accent hover:text-foreground',
        className
      )}
    >
      {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
