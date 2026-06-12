import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';

// Public pages
import Landing from './pages/public/Landing';
import CompanySignup from './pages/public/CompanySignup';
import PendingApproval from './pages/public/PendingApproval';
import RejectedAccount from './pages/public/RejectedAccount';

// Auth pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Dashboards
import Dashboard from './pages/tenant-admin/Dashboard';
import SuperDashboard from './pages/super-admin/SuperDashboard';

// Shared pages
import Students from './pages/shared/Students';
import StudentDetail from './pages/shared/StudentDetail';
import StudentForm from './pages/shared/StudentForm';
import Applications from './pages/shared/Applications';
import ApplicationDetail from './pages/shared/ApplicationDetail';
import ApplicationForm from './pages/shared/ApplicationForm';
import Payments from './pages/shared/Payments';
import Commission from './pages/shared/Commission';
import Users from './pages/shared/Users';
import Universities from './pages/shared/Universities';
import UniversityDetail from './pages/shared/UniversityDetail';
import Analytics from './pages/shared/Analytics';
import Settings from './pages/shared/Settings';

// Super admin pages
import Tenants from './pages/super-admin/Tenants';
import TenantDetail from './pages/super-admin/TenantDetail';
import TenantForm from './pages/super-admin/TenantForm';
import ActivityLog from './pages/super-admin/ActivityLog';
import CompanyApprovals from './pages/super-admin/CompanyApprovals';

// Where a pending/rejected company user should be sent (null = full access)
function statusRedirect(user) {
  const status = user?.tenant?.status;
  if (status === 'PENDING') return '/pending';
  if (status === 'REJECTED') return '/rejected';
  return null;
}

// Protected route wrapper
function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  // Gate pending/rejected company users out of the dashboard.
  const gated = statusRedirect(user);
  if (gated) return <Navigate to={gated} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
}

// Redirect to role-appropriate dashboard (or pending/rejected screen)
function RoleRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  const gated = statusRedirect(user);
  if (gated) return <Navigate to={gated} replace />;
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/super-admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

// Standalone screen accessible only to authenticated users with a given tenant status.
function StatusOnlyRoute({ status, children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.tenant?.status !== status) return <RoleRedirect />;
  return children;
}

// Root: show public landing for guests, redirect authenticated users to their dashboard
function Home() {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <RoleRedirect /> : <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Public landing & company signup */}
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<CompanySignup />} />

        {/* Pending / rejected company screens (authenticated, status-gated) */}
        <Route
          path="/pending"
          element={
            <StatusOnlyRoute status="PENDING">
              <PendingApproval />
            </StatusOnlyRoute>
          }
        />
        <Route
          path="/rejected"
          element={
            <StatusOnlyRoute status="REJECTED">
              <RejectedAccount />
            </StatusOnlyRoute>
          }
        />

        {/* Tenant Admin + Staff app routes */}
        <Route
          element={
            <ProtectedRoute roles={['TENANT_ADMIN', 'STAFF']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Students — order matters: /students/new must come before /students/:id */}
          <Route path="/students" element={<Students />} />
          <Route path="/students/new" element={<StudentForm />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/students/:id/edit" element={<StudentForm />} />

          {/* Applications — /applications/new before /applications/:id */}
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/new" element={<ApplicationForm />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/applications/:id/edit" element={<ApplicationForm />} />

          {/* Other modules */}
          <Route path="/payments" element={<Payments />} />
          <Route path="/commission" element={<Commission />} />
          <Route path="/users" element={<Users />} />
          <Route path="/universities" element={<Universities />} />
          <Route path="/universities/:id" element={<UniversityDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />

          {/* Documents — served from StudentDetail tabs */}
          <Route path="/documents" element={<Navigate to="/students" replace />} />
        </Route>

        {/* Super Admin routes */}
        <Route
          element={
            <ProtectedRoute roles={['SUPER_ADMIN']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/super-admin" element={<SuperDashboard />} />
          <Route path="/super-admin/tenants" element={<Tenants />} />
          <Route path="/super-admin/tenants/new" element={<TenantForm />} />
          <Route path="/super-admin/tenants/:id" element={<TenantDetail />} />
          <Route path="/super-admin/tenants/:id/edit" element={<TenantForm />} />
          <Route path="/super-admin/approvals" element={<CompanyApprovals />} />
          <Route path="/super-admin/universities" element={<Universities />} />
          <Route path="/super-admin/universities/:id" element={<UniversityDetail />} />
          <Route path="/super-admin/analytics" element={<Analytics />} />
          <Route path="/super-admin/activity" element={<ActivityLog />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Fallback routes */}
        <Route
          path="/unauthorized"
          element={
            <div className="flex h-screen items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold">403 — Unauthorized</h1>
                <p className="mt-2 text-muted-foreground">You don't have permission to access this page.</p>
              </div>
            </div>
          }
        />
        <Route
          path="*"
          element={
            <div className="flex h-screen items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold">404 — Not Found</h1>
                <p className="mt-2 text-muted-foreground">This page doesn't exist.</p>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
