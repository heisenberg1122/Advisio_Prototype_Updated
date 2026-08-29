import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import StudentLayout from './app/student/layout';
import StudentDashboardPage from './app/student/dashboard/page';

import AdviserLayout from './app/adviser/layout';
import AdviserDashboardPage from './app/adviser/dashboard/page';

import PanelistLayout from './app/panelist/layout';
import PanelistDashboardPage from './app/panelist/dashboard/page';

import ProfessorLayout from './app/professor/layout';
import ProfessorDashboardPage from './app/professor/dashboard/page';

import SystemAdminLayout from './app/system-admin/layout';
import SystemAdminDashboardPage from './app/system-admin/dashboard/page';

import AdminLayout from './app/admin/layout';
import AdminDashboardPage from './app/admin/dashboard/page';

import LoginPage from './app/(public)/login/page';
import RegisterPage from './app/(public)/register/page';
import ForgotPasswordPage from './app/(public)/forgot-password/page';
import FirstTimeSetupPage from './app/(public)/first-login-setup/page';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/first-login-setup" element={<FirstTimeSetupPage />} />

      {/* Student Portal */}
      <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
      <Route
        path="/student/*"
        element={
          <StudentLayout>
            <StudentDashboardPage />
          </StudentLayout>
        }
      />

      {/* Adviser Portal */}
      <Route path="/adviser" element={<Navigate to="/adviser/dashboard" replace />} />
      <Route
        path="/adviser/*"
        element={
          <AdviserLayout>
            <AdviserDashboardPage />
          </AdviserLayout>
        }
      />

      {/* Panelist Portal */}
      <Route path="/panelist" element={<Navigate to="/panelist/dashboard" replace />} />
      <Route
        path="/panelist/*"
        element={
          <PanelistLayout>
            <PanelistDashboardPage />
          </PanelistLayout>
        }
      />

      {/* Professor Portal */}
      <Route path="/professor" element={<Navigate to="/professor/dashboard" replace />} />
      <Route
        path="/professor/*"
        element={
          <ProfessorLayout>
            <ProfessorDashboardPage />
          </ProfessorLayout>
        }
      />

      {/* System Admin Portal */}
      <Route path="/system-admin" element={<Navigate to="/system-admin/dashboard" replace />} />
      <Route
        path="/system-admin/*"
        element={
          <SystemAdminLayout>
            <SystemAdminDashboardPage />
          </SystemAdminLayout>
        }
      />

      {/* Institutional Admin Portal */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route
        path="/admin/*"
        element={
          <AdminLayout>
            <AdminDashboardPage />
          </AdminLayout>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
