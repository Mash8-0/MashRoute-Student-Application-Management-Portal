import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, GraduationCap, FileText, CreditCard,
  Building2, Settings, LogOut, ChevronLeft, ChevronRight,
  BarChart3, BookOpen, Globe, Activity, ClipboardCheck, Wallet,
} from 'lucide-react';
import { cn, getInitials } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { authAPI } from '../../api/endpoints';
import CompanyBrand from './CompanyBrand';

const navConfig = {
  SUPER_ADMIN: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/super-admin' },
    { label: 'Tenants', icon: Building2, path: '/super-admin/tenants' },
    { label: 'Approvals', icon: ClipboardCheck, path: '/super-admin/approvals' },
    { label: 'Universities', icon: Globe, path: '/super-admin/universities' },
    { label: 'Analytics', icon: BarChart3, path: '/super-admin/analytics' },
    { label: 'Activity Log', icon: Activity, path: '/super-admin/activity' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  TENANT_ADMIN: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { label: 'Applications', icon: FileText, path: '/applications' },
    { label: 'Documents', icon: BookOpen, path: '/documents' },
    { label: 'Payments', icon: CreditCard, path: '/payments' },
    { label: 'Commission', icon: Wallet, path: '/commission' },
    { label: 'Staff', icon: Users, path: '/users' },
    { label: 'Universities', icon: Globe, path: '/universities' },
    { label: 'Analytics', icon: BarChart3, path: '/analytics' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
  STAFF: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Students', icon: GraduationCap, path: '/students' },
    { label: 'Applications', icon: FileText, path: '/applications' },
    { label: 'Payments', icon: CreditCard, path: '/payments' },
    { label: 'Commission', icon: Wallet, path: '/commission' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ],
};

export default function Sidebar({ mobile = false }) {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  const navItems = navConfig[user?.role] || navConfig.STAFF;

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    if (mobile) setSidebarOpen(false);
  };

  return (
    <div className="relative z-10 h-full flex-shrink-0">
    <motion.aside
      animate={{ width: mobile || sidebarOpen ? 240 : 72 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex h-full flex-col border-r border-border bg-card overflow-hidden"
    >
      {/* Logo */}
      <div className="flex h-20 items-center justify-center border-b border-border px-4">
        <AnimatePresence initial={false} mode="wait">
          {mobile || sidebarOpen ? (
            <motion.div
              key="logo-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex w-full items-center gap-3"
            >
              <img
                src="/logo-icon.png"
                alt="MashRoute"
                className="h-10 w-10 flex-shrink-0 self-center object-contain"
              />
              <div className="flex flex-col justify-center gap-[4px]">
                <span
                  className="text-[15px] font-extrabold leading-none tracking-tight"
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
                  className="text-[8.5px] font-semibold leading-none tracking-[0.12em] uppercase whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(135deg, #00D4FF 0%, #5B7FFF 55%, #8B4FE8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    opacity: 0.65,
                  }}
                >
                  Student App. Management
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.img
              key="logo-icon"
              src="/logo-icon.png"
              alt="MashRoute"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-10 w-10 object-contain"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Company brand (tenant) */}
      <AnimatePresence initial={false}>
        {(mobile || sidebarOpen) && user?.tenant?.name && (
          <motion.div
            key="company-brand"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border"
          >
            <div className="px-3 py-2.5">
              <CompanyBrand
                name={user.tenant.name}
                logo={user.tenant.logo}
                size="sm"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard' || item.path === '/super-admin'}
            onClick={handleNavClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                'text-muted-foreground hover:bg-accent hover:text-foreground',
                isActive && 'bg-primary/10 text-primary hover:bg-primary/10'
              )
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <AnimatePresence>
              {(mobile || sidebarOpen) && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-3 space-y-1">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <AnimatePresence>
            {(mobile || sidebarOpen) && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {getInitials(`${user?.firstName} ${user?.lastName}`)}
          </div>
          <AnimatePresence>
            {(mobile || sidebarOpen) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0"
              >
                <p className="truncate text-xs font-semibold text-foreground">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.role?.replace('_', ' ')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </motion.aside>

      {/* Toggle button — sibling of the aside so it isn't clipped by overflow-hidden.
          Centered on the right border (-translate-x-1/2) and vertically centered
          within the logo header so it never overlaps the company-brand row. */}
      {!mobile && (
      <button
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        className="absolute -right-3.5 top-20 z-30 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:bg-accent hover:text-foreground transition-colors"
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        )}
      </button>
      )}
    </div>
  );
}
