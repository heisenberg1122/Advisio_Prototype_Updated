import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShellSkeleton } from "@/components/ui/Skeleton";

// Lazy-loaded Portal Layouts & Pages for route-based code splitting
const StudentLayout = lazy(() => import("./app/student/layout"));
const StudentDashboardPage = lazy(() => import("./app/student/dashboard/page"));
const StudentGroupsPage = lazy(() => import("./app/student/groups/page"));
const StudentAdviserPoolPage = lazy(
  () => import("./app/student/adviser-pool/page"),
);
const StudentTasksPage = lazy(() => import("./app/student/tasks/page"));
const StudentDocumentsPage = lazy(() => import("./app/student/documents/page"));
const StudentGroupFilesPage = lazy(() => import("./app/student/group-files/page"));
const JoinResearchGroupPage = lazy(() => import("./app/student/join-group/page"));
const JoinWorkflowPage = lazy(() => import("./app/student/workflows/join/page"));
const StudentSubmissionsPage = lazy(
  () => import("./app/student/submissions/page"),
);
const StudentConsultationsPage = lazy(
  () => import("./app/student/consultations/page"),
);
const StudentDefensePage = lazy(() => import("./app/student/defense/page"));
const StudentGradesPage = lazy(() => import("./app/student/grades/page"));
const StudentNotificationsPage = lazy(
  () => import("./app/student/notifications/page"),
);
const StudentProfilePage = lazy(() => import("./app/student/profile/page"));
const StudentProfileEditPage = lazy(
  () => import("./app/student/profile/edit/page"),
);
const StudentSettingsPage = lazy(() => import("./app/student/settings/page"));

const AdviserLayout = lazy(() => import("./app/adviser/layout"));
const AdviserDashboardPage = lazy(() => import("./app/adviser/dashboard/page"));
const AdviserProfilePage = lazy(() => import("./app/adviser/profile/page"));
const AdviserProfileEditPage = lazy(
  () => import("./app/adviser/profile/edit/page"),
);

const PanelistLayout = lazy(() => import("./app/panelist/layout"));
const PanelistDashboardPage = lazy(
  () => import("./app/panelist/dashboard/page"),
);
const PanelistProfilePage = lazy(() => import("./app/panelist/profile/page"));
const PanelistProfileEditPage = lazy(
  () => import("./app/panelist/profile/edit/page"),
);

const ProfessorLayout = lazy(() => import("./app/professor/layout"));
const ProfessorDashboardPage = lazy(
  () => import("./app/professor/dashboard/page"),
);
const ProfessorProfilePage = lazy(() => import("./app/professor/profile/page"));
const ProfessorProfileEditPage = lazy(
  () => import("./app/professor/profile/edit/page"),
);

const SystemAdminLayout = lazy(() => import("./app/system-admin/layout"));
const SystemAdminDashboardPage = lazy(
  () => import("./app/system-admin/dashboard/page"),
);
const SystemAdminNotificationsPage = lazy(
  () => import("./app/system-admin/notifications/page"),
);
const SystemAdminProfilePage = lazy(
  () => import("./app/system-admin/profile/page"),
);
const SystemAdminProfileEditPage = lazy(
  () => import("./app/system-admin/profile/edit/page"),
);

const AdminLayout = lazy(() => import("./app/admin/layout"));
const AdminDashboardPage = lazy(() => import("./app/admin/dashboard/page"));
const AdminProfilePage = lazy(() => import("./app/admin/profile/page"));
const AdminProfileEditPage = lazy(
  () => import("./app/admin/profile/edit/page"),
);
const CalendarPage = lazy(() => import("./app/calendar/page"));
const SignatureCenterPage = lazy(() => import("./app/signatures/page"));
const MailInboxPage = lazy(() => import("./app/mail/page"));

// Public Auth Pages
import LoginPage from "./app/(public)/login/page";
import RegisterPage from "./app/(public)/register/page";
import ResearcherOnboardingPage from "./app/(public)/researcher-onboarding/page";
import ForgotPasswordPage from "./app/(public)/forgot-password/page";
import FirstTimeSetupPage from "./app/(public)/first-login-setup/page";

function RouteLoader() {
  return <AppShellSkeleton />;
}

function StudentPortal({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["RESEARCHER", "STUDENT"]}>
      <StudentLayout>{children}</StudentLayout>
    </ProtectedRoute>
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
        <Route path="/researcher-onboarding" element={<ResearcherOnboardingPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/first-login-setup" element={<FirstTimeSetupPage />} />

        {/* Student / Researcher Portal */}
        <Route
          path="/dashboard"
          element={
            <StudentPortal>
              <StudentDashboardPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student"
          element={<Navigate to="/student/dashboard" replace />}
        />
        <Route
          path="/student/dashboard"
          element={
            <StudentPortal>
              <StudentDashboardPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/groups"
          element={
            <StudentPortal>
              <StudentGroupsPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/adviser-pool"
          element={
            <StudentPortal>
              <StudentAdviserPoolPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/tasks"
          element={
            <StudentPortal>
              <StudentTasksPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/documents"
          element={
            <StudentPortal>
              <StudentDocumentsPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/group-files"
          element={
            <StudentPortal>
              <StudentGroupFilesPage />
            </StudentPortal>
          }
        />
        <Route
          path="/join-group"
          element={
            <StudentPortal>
              <JoinResearchGroupPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/workflows/join/:code"
          element={
            <StudentPortal>
              <JoinWorkflowPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/submissions"
          element={
            <StudentPortal>
              <StudentSubmissionsPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/consultations"
          element={
            <StudentPortal>
              <StudentConsultationsPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/defense"
          element={
            <StudentPortal>
              <StudentDefensePage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/grades"
          element={
            <StudentPortal>
              <StudentGradesPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/notifications"
          element={
            <StudentPortal>
              <StudentNotificationsPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/profile"
          element={
            <StudentPortal>
              <StudentProfilePage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/profile/edit"
          element={
            <StudentPortal>
              <StudentProfileEditPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/settings"
          element={
            <StudentPortal>
              <StudentSettingsPage />
            </StudentPortal>
          }
        />
        <Route path="/student/calendar" element={<StudentPortal><CalendarPage /></StudentPortal>} />
        <Route path="/student/inbox" element={<StudentPortal><MailInboxPage /></StudentPortal>} />
        <Route
          path="/student/*"
          element={<Navigate to="/student/dashboard" replace />}
        />

        {/* Adviser Portal */}
        <Route
          path="/adviser"
          element={<Navigate to="/adviser/dashboard" replace />}
        />
        <Route
          path="/adviser/profile"
          element={
            <ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}>
              <AdviserLayout>
                <AdviserProfilePage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/adviser/profile/edit"
          element={
            <ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}>
              <AdviserLayout>
                <AdviserProfileEditPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/adviser/settings"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AdviserLayout>
                <StudentSettingsPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/adviser/*"
          element={
            <ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}>
              <AdviserLayout>
                <AdviserDashboardPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/adviser/calendar" element={<ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}><AdviserLayout><CalendarPage /></AdviserLayout></ProtectedRoute>} />
        <Route path="/adviser/inbox" element={<ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}><AdviserLayout><MailInboxPage /></AdviserLayout></ProtectedRoute>} />

        {/* Panelist Portal */}
        <Route
          path="/panelist"
          element={<Navigate to="/panelist/dashboard" replace />}
        />
        <Route
          path="/panelist/profile"
          element={
            <ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}>
              <PanelistLayout>
                <PanelistProfilePage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/panelist/profile/edit"
          element={
            <ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}>
              <PanelistLayout>
                <PanelistProfileEditPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/panelist/settings"
          element={
            <ProtectedRoute allowedRoles={["PANELIST"]}>
              <PanelistLayout>
                <StudentSettingsPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/panelist/*"
          element={
            <ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}>
              <PanelistLayout>
                <PanelistDashboardPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/panelist/calendar" element={<ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}><PanelistLayout><CalendarPage /></PanelistLayout></ProtectedRoute>} />
        <Route path="/panelist/inbox" element={<ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}><PanelistLayout><MailInboxPage /></PanelistLayout></ProtectedRoute>} />

        {/* Professor / Coordinator Portal */}
        <Route
          path="/professor"
          element={<Navigate to="/professor/dashboard" replace />}
        />
        <Route
          path="/professor/profile"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PROFESSOR",
                "RESEARCH_COORDINATOR",
                "SYSTEM_ADMIN",
              ]}
            >
              <ProfessorLayout>
                <ProfessorProfilePage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/profile/edit"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PROFESSOR",
                "RESEARCH_COORDINATOR",
                "SYSTEM_ADMIN",
              ]}
            >
              <ProfessorLayout>
                <ProfessorProfileEditPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/settings"
          element={
            <ProtectedRoute
              allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}
            >
              <ProfessorLayout>
                <StudentSettingsPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/*"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PROFESSOR",
                "RESEARCH_COORDINATOR",
                "SYSTEM_ADMIN",
              ]}
            >
              <ProfessorLayout>
                <ProfessorDashboardPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/professor/calendar" element={<ProtectedRoute allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR", "SYSTEM_ADMIN"]}><ProfessorLayout><CalendarPage /></ProfessorLayout></ProtectedRoute>} />
        <Route path="/professor/inbox" element={<ProtectedRoute allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR", "SYSTEM_ADMIN"]}><ProfessorLayout><MailInboxPage /></ProfessorLayout></ProtectedRoute>} />
        <Route path="/professor/signatures" element={<ProtectedRoute allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}><ProfessorLayout><SignatureCenterPage /></ProfessorLayout></ProtectedRoute>} />

        {/* System Admin Portal */}
        <Route
          path="/system-admin"
          element={<Navigate to="/system-admin/dashboard" replace />}
        />
        <Route
          path="/system-admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
              <SystemAdminLayout>
                <SystemAdminDashboardPage />
              </SystemAdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-admin/notifications"
          element={
            <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
              <SystemAdminLayout>
                <SystemAdminNotificationsPage />
              </SystemAdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-admin/profile"
          element={
            <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
              <SystemAdminLayout>
                <SystemAdminProfilePage />
              </SystemAdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-admin/profile/edit"
          element={
            <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
              <SystemAdminLayout>
                <SystemAdminProfileEditPage />
              </SystemAdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-admin/*"
          element={<Navigate to="/system-admin/dashboard" replace />}
        />
        <Route path="/system-admin/calendar" element={<ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}><SystemAdminLayout><CalendarPage /></SystemAdminLayout></ProtectedRoute>} />
        <Route path="/system-admin/inbox" element={<ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}><SystemAdminLayout><MailInboxPage /></SystemAdminLayout></ProtectedRoute>} />

        {/* Institutional Admin Portal */}
        <Route
          path="/admin"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN", "SYSTEM_ADMIN", "RPO", "REB", "VPAA"]}
            >
              <AdminLayout>
                <AdminProfilePage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/profile/edit"
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN", "SYSTEM_ADMIN", "RPO", "REB", "VPAA"]}
            >
              <AdminLayout>
                <AdminProfileEditPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "RPO", "REB", "VPAA"]}>
              <AdminLayout>
                <StudentSettingsPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN", "SYSTEM_ADMIN", "RPO", "REB", "VPAA"]}
            >
              <AdminLayout>
                <AdminDashboardPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/admin/calendar" element={<ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "RPO", "REB", "VPAA"]}><AdminLayout><CalendarPage /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/signatures" element={<ProtectedRoute allowedRoles={["RPO", "VPAA"]}><AdminLayout><SignatureCenterPage /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/inbox" element={<ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "RPO", "REB", "VPAA"]}><AdminLayout><MailInboxPage /></AdminLayout></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
