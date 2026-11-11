import React, { Suspense, lazy } from "react";
import EvaluationPage from "./components/evaluation/EvaluationPage";
import EvaluationGuide from "./components/evaluation/EvaluationGuide";
import ResearcherWalkthroughPage from "./components/evaluation/ResearcherWalkthrough";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginRoute } from "@/components/auth/LoginRoute";
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
const FacultyTaskDetailsPage = lazy(
  () => import("./components/workflow/FacultyTaskDetailsPage"),
);
const StudentDocumentsPage = lazy(() => import("./app/student/documents/page"));
const StudentGroupFilesPage = lazy(
  () => import("./app/student/group-files/page"),
);
const JoinResearchGroupPage = lazy(
  () => import("./app/student/join-group/page"),
);
const JoinWorkflowPage = lazy(
  () => import("./app/student/workflows/join/page"),
);
const StudentConsultationsPage = lazy(
  () => import("./app/student/consultations/page"),
);
const StudentDefensePage = lazy(() => import("./app/student/defense/page"));
const CertificateVerificationPage = lazy(() => import("./app/(public)/certificate-verification/page"));
const StudentGradesPage = lazy(() => import("./app/student/grades/page"));
const StudentNotificationsPage = lazy(
  () => import("./app/student/notifications/page"),
);
const StudentProfileEditPage = lazy(
  () => import("./app/student/profile/edit/page"),
);
const StudentSettingsPage = lazy(() => import("./app/student/settings/page"));
const AccountSettingsPage = lazy(() => import("./components/settings/AccountSettingsPage"));

const AdviserLayout = lazy(() => import("./app/adviser/layout"));
const AdviserDashboardPage = lazy(() => import("./app/adviser/dashboard/page"));
const AdviserResearchGroupWorkspacePage = lazy(
  () => import("./app/adviser/advisees/[researchId]/page"),
);
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
const PanelistDefenseWorkspacePage = lazy(
  () => import("./app/panelist/defenses/[sessionId]/page"),
);
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
const ProfessorProfileEditPage = lazy(
  () => import("./app/professor/profile/edit/page"),
);
const ProfessorReviewsPage = lazy(() => import("./app/professor/reviews/page"));
const ClassRecordPage = lazy(
  () => import("./components/grading/ClassRecordWorkspace"),
);
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
const SystemAdminProfileEditPage = lazy(
  () => import("./app/system-admin/profile/edit/page"),
);

const AdminLayout = lazy(() => import("./app/admin/layout"));
const AdminDashboardPage = lazy(() => import("./app/admin/dashboard/page"));
const AdminProfileEditPage = lazy(
  () => import("./app/admin/profile/edit/page"),
);
const AdminReviewsPage = lazy(() => import("./app/admin/reviews/page"));
const FacultyAccessPage = lazy(() => import("./app/admin/faculty-access/page"));
const AdminNotificationsPage = lazy(
  () => import("./app/admin/notifications/page"),
);
const CalendarPage = lazy(() => import("./app/calendar/page"));
const FacultyConsultationsPage = lazy(
  () => import("./components/consultations/FacultyConsultationsPage"),
);
const SignatureCenterPage = lazy(() => import("./app/signatures/page"));
const MailInboxPage = lazy(() => import("./app/mail/page"));

// Public Auth Pages
import LoginPage from "./app/(public)/login/page";
import HomePage from "./app/(public)/home/page";
import PrivacyPolicyPage from "./app/(public)/privacy-policy/page";
import TermsOfServicePage from "./app/(public)/terms-of-service/page";
import RegisterPage from "./app/(public)/register/page";
import ResearcherOnboardingPage from "./app/(public)/researcher-onboarding/page";
import ForgotPasswordPage from "./app/(public)/forgot-password/page";
import FirstTimeSetupPage from "./app/(public)/first-login-setup/page";
import GoogleOnboardingPage from "./app/(public)/google-onboarding/page";
import ChooseDashboardPage from "./app/(public)/choose-dashboard/page";
const AcceptInvitationPage = lazy(
  () => import("./app/(public)/accept-invitation/page"),
);

function RouteLoader() {
  const { pathname, search } = useLocation();
  return <AppShellSkeleton pathname={pathname} search={search} />;
}

function StudentPortal({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["RESEARCHER", "STUDENT"]}>
      <StudentLayout>{children}</StudentLayout>
    </ProtectedRoute>
  );
}

function LegacyProfileRoute({ settingsPath, faculty = false }: { settingsPath: string; faculty?: boolean }) {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  params.delete("tab");
  if (faculty) params.set("section", "faculty");
  const query = params.toString();
  return <Navigate to={`${settingsPath}${query ? `?${query}` : ""}${hash}`} replace />;
}

function StudentDashboardRoute() {
  const { search } = useLocation();
  const tab = new URLSearchParams(search).get("tab");
  return tab === "profile" || tab === "settings"
    ? <LegacyProfileRoute settingsPath="/student/settings" />
    : <StudentDashboardPage />;
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
        <Route path="/verify/certificate/:code" element={<CertificateVerificationPage />} />
        <Route path="/evaluate" element={<EvaluationPage />} />
        <Route path="/evaluate/print" element={<EvaluationPage print />} />
        <Route path="/evaluate/guide" element={<EvaluationGuide />} />
        <Route
          path="/walkthrough/research-dashboard"
          element={<ResearcherWalkthroughPage />}
        />
        {/* Public Auth Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route
          path="/login"
          element={
            <LoginRoute>
              <LoginPage />
            </LoginRoute>
          }
        />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/researcher-onboarding"
          element={<ResearcherOnboardingPage />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ForgotPasswordPage />} />
        <Route path="/first-login-setup" element={<FirstTimeSetupPage />} />
        <Route path="/google-onboarding" element={<GoogleOnboardingPage />} />
        <Route path="/choose-dashboard" element={<ChooseDashboardPage />} />
        <Route
          path="/accept-invitation"
          element={
            <Suspense
              fallback={
                <main
                  role="status"
                  className="grid min-h-screen place-items-center bg-[var(--color-background)] text-[var(--color-text-secondary)]"
                >
                  Opening invitation…
                </main>
              }
            >
              <AcceptInvitationPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/faculty-access"
          element={
            <ProtectedRoute allowedRoles={["DEAN", "SYSTEM_ADMIN"]}>
              <AdminLayout>
                <FacultyAccessPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {([
          { portal: "professor", workspace: "coordinator", roles: ["PROFESSOR", "RESEARCH_COORDINATOR"], Layout: ProfessorLayout },
          { portal: "panelist", workspace: "panelist", roles: ["PANELIST"], Layout: PanelistLayout },
          { portal: "admin", workspace: "dean", roles: ["DEAN", "SYSTEM_ADMIN"], Layout: AdminLayout },
        ] as const).map(({ portal, workspace, roles, Layout }) => (
          <Route
            key={portal}
            path={`/${portal}/consultations`}
            element={
              <ProtectedRoute allowedRoles={[...roles]}>
                <Layout>
                  <FacultyConsultationsPage workspace={workspace} />
                </Layout>
              </ProtectedRoute>
            }
          />
        ))}

        {/* Student / Researcher Portal */}
        {[
          { portal: "adviser", roles: ["ADVISER"], Layout: AdviserLayout },
          {
            portal: "professor",
            roles: ["PROFESSOR", "RESEARCH_COORDINATOR"],
            Layout: ProfessorLayout,
          },
          { portal: "panelist", roles: ["PANELIST"], Layout: PanelistLayout },
          { portal: "admin", roles: ["DEAN"], Layout: AdminLayout },
        ].map(({ portal, roles, Layout }) => (
          <Route
            key={`${portal}-task-details`}
            path={`/${portal}/tasks/:taskId`}
            element={
              <ProtectedRoute allowedRoles={roles}>
                <Layout>
                  <FacultyTaskDetailsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
        ))}
        <Route
          path="/dashboard"
          element={
            <StudentPortal>
              <StudentDashboardRoute />
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
              <StudentDashboardRoute />
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
        {["/student/join-group", "/join-group"].map(path => (
          <Route
            key={path}
            path={path}
            element={
              <StudentPortal>
                <JoinResearchGroupPage />
              </StudentPortal>
            }
          />
        ))}
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
              <LegacyProfileRoute settingsPath="/student/settings" />
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
        <Route
          path="/student/calendar"
          element={
            <StudentPortal>
              <CalendarPage />
            </StudentPortal>
          }
        />
        <Route
          path="/student/inbox"
          element={
            <StudentPortal>
              <MailInboxPage />
            </StudentPortal>
          }
        />
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
              <LegacyProfileRoute settingsPath="/adviser/settings" faculty />
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
          path="/adviser/advisees/:researchId"
          element={
            <ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}>
              <AdviserLayout>
                <AdviserResearchGroupWorkspacePage />
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
        <Route
          path="/adviser/calendar"
          element={
            <ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}>
              <AdviserLayout>
                <CalendarPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/adviser/inbox"
          element={
            <ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}>
              <AdviserLayout>
                <MailInboxPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/adviser/notifications"
          element={
            <ProtectedRoute allowedRoles={["ADVISER", "SYSTEM_ADMIN"]}>
              <AdviserLayout>
                <AdviserNotificationsPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/adviser/reviews"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AdviserLayout>
                <AdviserReviewsPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/adviser/documents"
          element={
            <ProtectedRoute allowedRoles={["ADVISER"]}>
              <AdviserLayout>
                <StudentDocumentsPage />
              </AdviserLayout>
            </ProtectedRoute>
          }
        />

        {/* Panelist Portal */}
        <Route
          path="/panelist"
          element={<Navigate to="/panelist/dashboard" replace />}
        />
        <Route
          path="/panelist/profile"
          element={
            <ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}>
              <LegacyProfileRoute settingsPath="/panelist/settings" />
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
        <Route
          path="/panelist/calendar"
          element={
            <ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}>
              <PanelistLayout>
                <CalendarPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/panelist/inbox"
          element={
            <ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}>
              <PanelistLayout>
                <MailInboxPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/panelist/notifications"
          element={
            <ProtectedRoute allowedRoles={["PANELIST", "SYSTEM_ADMIN"]}>
              <PanelistLayout>
                <PanelistNotificationsPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/panelist/reviews"
          element={
            <ProtectedRoute allowedRoles={["PANELIST"]}>
              <PanelistLayout>
                <PanelistReviewsPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/panelist/documents"
          element={
            <ProtectedRoute allowedRoles={["PANELIST"]}>
              <PanelistLayout>
                <StudentDocumentsPage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/panelist/defenses/:sessionId"
          element={
            <ProtectedRoute allowedRoles={["PANELIST"]}>
              <PanelistLayout>
                <PanelistDefenseWorkspacePage />
              </PanelistLayout>
            </ProtectedRoute>
          }
        />

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
              <LegacyProfileRoute settingsPath="/professor/settings" />
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
        <Route
          path="/professor/calendar"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PROFESSOR",
                "RESEARCH_COORDINATOR",
                "SYSTEM_ADMIN",
              ]}
            >
              <ProfessorLayout>
                <CalendarPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/inbox"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PROFESSOR",
                "RESEARCH_COORDINATOR",
                "SYSTEM_ADMIN",
              ]}
            >
              <ProfessorLayout>
                <MailInboxPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/notifications"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PROFESSOR",
                "RESEARCH_COORDINATOR",
                "SYSTEM_ADMIN",
              ]}
            >
              <ProfessorLayout>
                <ProfessorNotificationsPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/signatures"
          element={
            <ProtectedRoute
              allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}
            >
              <ProfessorLayout>
                <SignatureCenterPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/reviews"
          element={
            <ProtectedRoute
              allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}
            >
              <ProfessorLayout>
                <ProfessorReviewsPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/class-record"
          element={
            <ProtectedRoute
              allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}
            >
              <ProfessorLayout>
                <ClassRecordPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/professor/documents"
          element={
            <ProtectedRoute
              allowedRoles={["PROFESSOR", "RESEARCH_COORDINATOR"]}
            >
              <ProfessorLayout>
                <StudentDocumentsPage />
              </ProfessorLayout>
            </ProtectedRoute>
          }
        />

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
              <LegacyProfileRoute settingsPath="/system-admin/settings" />
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
          path="/system-admin/settings"
          element={
            <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
              <SystemAdminLayout>
                <AccountSettingsPage />
              </SystemAdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-admin/*"
          element={<Navigate to="/system-admin/dashboard" replace />}
        />
        <Route
          path="/system-admin/calendar"
          element={
            <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
              <SystemAdminLayout>
                <CalendarPage />
              </SystemAdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-admin/inbox"
          element={
            <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
              <SystemAdminLayout>
                <MailInboxPage />
              </SystemAdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Institutional Admin Portal */}
        <Route
          path="/admin"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "DEAN"]}>
              <LegacyProfileRoute settingsPath="/admin/settings" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/profile/edit"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "DEAN"]}>
              <AdminLayout>
                <AdminProfileEditPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "DEAN"]}>
              <AdminLayout>
                <StudentSettingsPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "DEAN"]}>
              <AdminLayout>
                <AdminDashboardPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/calendar"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "DEAN"]}>
              <AdminLayout>
                <CalendarPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/signatures"
          element={
            <Navigate to="/admin/inbox?view=signature-requests" replace />
          }
        />
        <Route
          path="/admin/inbox"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "DEAN"]}>
              <AdminLayout>
                <MailInboxPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN", "DEAN"]}>
              <AdminLayout>
                <AdminNotificationsPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reviews"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "DEAN"]}>
              <AdminLayout>
                <AdminReviewsPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/documents"
          element={
            <ProtectedRoute allowedRoles={["DEAN"]}>
              <AdminLayout>
                <StudentDocumentsPage />
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
