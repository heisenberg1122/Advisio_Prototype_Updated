import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Lazy-loaded Portal Layouts & Pages for route-based code splitting
const StudentLayout = lazy(() => import('./app/student/layout'));
const StudentDashboardPage = lazy(() => import('./app/student/dashboard/page'));

const AdviserLayout = lazy(() => import('./app/adviser/layout'));
const AdviserDashboardPage = lazy(() => import('./app/adviser/dashboard/page'));

const PanelistLayout = lazy(() => import('./app/panelist/layout'));
const PanelistDashboardPage = lazy(() => import('./app/panelist/dashboard/page'));

const ProfessorLayout = lazy(() => import('./app/professor/layout'));
const ProfessorDashboardPage = lazy(() => import('./app/professor/dashboard/page'));

const SystemAdminLayout = lazy(() => import('./app/system-admin/layout'));
const SystemAdminDashboardPage = lazy(() => import('./app/system-admin/dashboard/page'));

const AdminLayout = lazy(() => import('./app/admin/layout'));
const AdminDashboardPage = lazy(() => import('./app/admin/dashboard/page'));

// Public Auth Pages
import LoginPage from './app/(public)/login/page';
import RegisterPage from './app/(public)/register/page';
import ForgotPasswordPage from './app/(public)/forgot-password/page';
import FirstTimeSetupPage from './app/(public)/first-login-setup/page';

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080e18]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#1b4264] dark:border-[#ffa400] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading portal...</p>
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/first-login-setup" element={<FirstTimeSetupPage />} />

        {/* Student / Researcher Portal */}
        <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRoles={['RESEARCHER', 'STUDENT']}>
              <StudentLayout>
                <StudentDashboardPage />
              </StudentLayout>
            </ProtectedRoute>
          }
        />

        {/* Adviser Portal */}
        <Route path="/adviser" element={<Navigate to="/adviser/dashboard" replace />} />
        <Route
          path="/adviser/*"
          element={
            <ProtectedRoute allowedRoles={['ADVISER', 'SYSTEM_ADMIN']}>
              <AdviserLayout>
                <AdviserDashboardPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />

        {/* Panelist Portal */}
        <Route path="/panelist" element={<Navigate to="/panelist/dashboard" replace />} />
        <Route
          path="/panelist/*"
          element={
            <ProtectedRoute allowedRoles={['PANELIST', 'SYSTEM_ADMIN']}>
              <PanelistLayout>
                <PanelistDashboardPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />

        {/* Professor / Coordinator Portal */}
        <Route path="/professor" element={<Navigate to="/professor/dashboard" replace />} />
        <Route
          path="/professor/*"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'RESEARCH_COORDINATOR', 'SYSTEM_ADMIN']}>
              <ProfessorLayout>
                <ProfessorDashboardPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />

        {/* System Admin Portal */}
        <Route path="/system-admin" element={<Navigate to="/system-admin/dashboard" replace />} />
        <Route
          path="/system-admin/*"
          element={
            <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']}>
              <SystemAdminLayout>
                <SystemAdminDashboardPage />
              </SystemAdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Institutional Admin Portal */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SYSTEM_ADMIN', 'RPO', 'REB', 'VPAA']}>
              <AdminLayout>
                <AdminDashboardPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
