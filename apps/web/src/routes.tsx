import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShellSkeleton } from "@/components/ui/Skeleton";
import {
  legacyProfessorMilestonesDestination,
  legacyPortalDashboardDestination,
  legacyStudentSubmissionsDestination,
} from "@/lib/legacy-route-redirects";

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
const AdviserReviewsPage = lazy(() => import("./app/adviser/reviews/page"));
const AdviserNotificationsPage = lazy(
  () => import("./app/adviser/notifications/page"),
);

const PanelistLayout = lazy(() => import("./app/panelist/layout"));
const PanelistDashboardPage = lazy(
  () => import("./app/panelist/dashboard/page"),
);
const PanelistProfilePage = lazy(() => import("./app/panelist/profile/page"));
const PanelistProfileEditPage = lazy(
  () => import("./app/panelist/profile/edit/page"),
);
const PanelistReviewsPage = lazy(() => import("./app/panelist/reviews/page"));
const PanelistNotificationsPage = lazy(
  () => import("./app/panelist/notifications/page"),
);

const ProfessorLayout = lazy(() => import("./app/professor/layout"));
const ProfessorDashboardPage = lazy(
  () => import("./app/professor/dashboard/page"),
);
const ProfessorProfilePage = lazy(() => import("./app/professor/profile/page"));
const ProfessorProfileEditPage = lazy(
  () => import("./app/professor/profile/edit/page"),
);
const ProfessorReviewsPage = lazy(() => import("./app/professor/reviews/page"));
const ProfessorNotificationsPage = lazy(
  () => import("./app/professor/notifications/page"),
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
const AdminReviewsPage = lazy(() => import("./app/admin/reviews/page"));
const AdminNotificationsPage = lazy(
  () => import("./app/admin/notifications/page"),
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
import GoogleOnboardingPage from "./app/(public)/google-onboarding/page";

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

function LegacyStudentSubmissionsRoute() {
  const location = useLocation();
  return (
    <Navigate
      to={`${legacyStudentSubmissionsDestination(location.search)}${location.hash}`}
      replace
    />
  );
}

function LegacyProfessorMilestonesRoute() {
  const location = useLocation();
  return (
    <Navigate
      to={`${legacyProfessorMilestonesDestination(location.search)}${location.hash}`}
      replace
    />
  );
}

function LegacyPortalDashboardRoute({
  portal,
  tab,
}: {
  portal: "adviser" | "professor";
  tab: string;
}) {
  const location = useLocation();
  return (
    <Navigate
      to={`${legacyPortalDashboardDestination(portal, tab, location.search)}${location.hash}`}
      replace
    />
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
        <Route path="/google-onboarding" element={<GoogleOnboardingPage />} />

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
          path="/student/tasks/:taskId"
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
              <LegacyStudentSubmissionsRoute />
            </StudentPortal>
          }
        />
        <Route
          path="/submissions"
          element={
            <StudentPortal>
              <LegacyStudentSubmissionsRoute />
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
          path="/student/defense/:sessionId"
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
        <Route path="/adviser/notifications" element={<ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}><AdviserLayout><AdviserNotificationsPage /></AdviserLayout></ProtectedRoute>} />
        <Route path="/adviser/reviews" element={<ProtectedRoute allowedRoles={["ADVISER"]}><AdviserLayout><AdviserReviewsPage /></AdviserLayout></ProtectedRoute>} />
        <Route path="/adviser/documents" element={<ProtectedRoute allowedRoles={["ADVISER"]}><AdviserLayout><StudentDocumentsPage /></AdviserLayout></ProtectedRoute>} />

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
        <Route path="/panelist/notifications" element={<ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}><PanelistLayout><PanelistNotificationsPage /></PanelistLayout></ProtectedRoute>} />
        <Route path="/panelist/reviews" element={<ProtectedRoute allowedRoles={["PANELIST"]}><PanelistLayout><PanelistReviewsPage /></PanelistLayout></ProtectedRoute>} />
        <Route path="/panelist/documents" element={<ProtectedRoute allowedRoles={["PANELIST"]}><PanelistLayout><StudentDocumentsPage /></PanelistLayout></ProtectedRoute>} />

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
        {[
          ["advisees", "advisees"],
          ["requests", "approvals"],
          ["consultations", "consultations"],
          ["tasks", "overview"],
          ["announcements", "overview"],
        ].map(([path, tab]) => (
          <Route
            key={path}
            path={`/adviser/${path}`}
            element={
              <ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}>
                <AdviserLayout>
                  <LegacyPortalDashboardRoute portal="adviser" tab={tab} />
                </AdviserLayout>
              </ProtectedRoute>
            }
          />
        ))}
        <Route
          path="/professor/milestones"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PROFESSOR",
                "RESEARCH_COORDINATOR",
                "SYSTEM_ADMIN",
              ]}
            >
              <ProfessorLayout>
                <LegacyProfessorMilestonesRoute />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        {[
          ["analytics", "tracking"],
          ["panelists", "defense"],
          ["plagiarism", "submissions"],
          ["rubric", "defense"],
        ].map(([path, tab]) => (
          <Route
            key={path}
            path={`/professor/${path}`}
            element={
              <ProtectedRoute
                allowedRoles={[
                  "PROFESSOR",
                  "RESEARCH_COORDINATOR",
                  "SYSTEM_ADMIN",
                ]}
              >
                <ProfessorLayout>
                  <LegacyPortalDashboardRoute portal="professor" tab={tab} />
                </ProfessorLayout>
              </ProtectedRoute>
            }
          />
        ))}
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
        <Route path="/professor/notifications" element={<ProtectedRoute allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR", "SYSTEM_ADMIN"]}><ProfessorLayout><ProfessorNotificationsPage /></ProfessorLayout></ProtectedRoute>} />
        <Route path="/professor/signatures" element={<ProtectedRoute allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}><ProfessorLayout><SignatureCenterPage /></ProfessorLayout></ProtectedRoute>} />
        <Route path="/professor/reviews" element={<ProtectedRoute allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}><ProfessorLayout><ProfessorReviewsPage /></ProfessorLayout></ProtectedRoute>} />
        <Route path="/professor/documents" element={<ProtectedRoute allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}><ProfessorLayout><StudentDocumentsPage /></ProfessorLayout></ProtectedRoute>} />

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
        <Route path="/admin/signatures" element={<Navigate to="/admin/inbox?view=signature-requests" replace />} />
        <Route path="/admin/inbox" element={<ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "RPO", "REB", "VPAA"]}><AdminLayout><MailInboxPage /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/notifications" element={<ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "RPO", "REB", "VPAA"]}><AdminLayout><AdminNotificationsPage /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/reviews" element={<ProtectedRoute allowedRoles={["ADMIN", "RPO", "REB", "VPAA"]}><AdminLayout><AdminReviewsPage /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/documents" element={<ProtectedRoute allowedRoles={["RPO", "VPAA"]}><AdminLayout><StudentDocumentsPage /></AdminLayout></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
