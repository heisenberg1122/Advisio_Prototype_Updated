# Advisio — Master Development Plan & Architecture State

> **Central Source of Truth** for the Advisio Research, Advising, and Management Platform.  
> Managed in accordance with the **Technical Specification v1.0**.

---

## 1. Current Architecture Stack

| Layer | Technology | Location |
|---|---|---|
| **Monorepo Manager** | Turborepo (`npm` workspaces) | Root (`package.json`, `turbo.json`) |
| **Frontend App** | Vite 6 + React 19 + TypeScript + React Router v6 | `apps/web/` |
| **Backend API** | Node.js + Express + TypeScript + `googleapis` + `multer` | `apps/api/` |
| **Database & ORM** | PostgreSQL 16 (Docker) + Prisma ORM (v6.19.3) | `packages/database/` |
| **Validation** | Zod (v3.24.2) | `packages/validations/` |
| **Auth & RBAC** | Custom JWT / Institutional RBAC & Dynamic DB Permission Matrix | `packages/auth/`, `packages/shared/`, `apps/api/` |

---

## 2. Completed Milestones & System Features

### 2.1 Git Branch Migration
- Renamed original `main` branch → `prototype-backup` (preserves original prototype commits & design history).
- Initialized fresh `main` branch as the protected release line.
- Created `develop` branch for active feature development and integration.

### 2.2 ORM Standardization
- Formally removed placeholder Drizzle ORM files from `packages/database`.
- Adopted **Prisma ORM** strictly complying with Technical Specification v1.0 requirements.

### 2.3 Database Architecture & Initialization (`packages/database`)
- **Complete Prisma Schema (`packages/database/prisma/schema.prisma`):**
  - **Configuration-Driven Engine:** Zero hardcoded colleges/programs/workflows.
  - **Organization Model:** `colleges`, `programs`, `academic_years`.
  - **User & RBAC Model:** `users`, `roles`, `user_roles`, `permissions`, `role_permissions`.
  - **Research Registry:** `research_types`, `research_projects`, `research_members` (supports project-level roles like `LEADER` without polluting global RBAC).
  - **Workflow Engine:** `workflows`, `workflow_stages`, `workflow_instances`, `workflow_transitions` (supports versioned workflow evolution).
  - **Documents & Reviews:** `documents`, `document_versions`, `reviews`, `review_comments`.
  - **Dynamic Forms:** `forms`, `form_fields`, `form_submissions` (JSON schema driven).
  - **Evaluations & Consultations:** `evaluation_templates`, `criteria`, `evaluations`, `consultations`, `participants`, `notes`.
  - **System Governance:** `notifications`, `audit_logs`, `certificates`, `dashboard_widgets`, `role_dashboard_widgets`, `dashboard_configs`.
- **Infrastructure & Exports:**
  - Configured `@research-management/database` package exporting singleton `PrismaClient` and generated TypeScript definitions.
  - Created root `docker-compose.yml` (PostgreSQL 16 Alpine container on port `5432`, database `advisio_dev`).
  - Created `.env.example` with standard local connection strings.
  - Seed script (`packages/database/src/seed.ts`) configured for 8 institutional roles, full permission matrix, sample college/program, academic year, and 7-stage BSIT workflow.
  - Resolved model relation constraints (`consultationParticipants` on `User`) and verified Prisma client generation.

### 2.4 Frontend Migration to Vite + React (`apps/web`)
- **Vite 6 + React 19 + React Router v6 SPA Conversion:**
  - Removed obsolete Next.js dependencies, server middleware (`middleware.ts`), and `next.config.ts`.
  - Configured `apps/web/vite.config.ts` with React plugin, path aliases, and routing bridge.
  - Implemented `apps/web/src/lib/router-compat.tsx` for seamless routing compatibility across all dashboard components (`next/link` & `next/navigation` shims mapped to `react-router-dom`).
  - Added HTML entry point (`apps/web/index.html`) with Tabler icons and Google Fonts (Inter).
  - Validated type safety (`tsc --noEmit`) and production bundling (`vite build` in ~2.3s) with 0 errors.

### 2.5 Role-Based Layout Routing & Navigation Restoration (`apps/web`)
- Wrapped all dashboard routes in `apps/web/src/routes.tsx` with their respective Layout components (`StudentLayout`, `AdviserLayout`, `PanelistLayout`, `ProfessorLayout`, `SystemAdminLayout`, `AdminLayout`).
- Restored two-column responsive layout grid, collapsible sidebars (`240px` / `64px`), dynamic topbars with unread notification counters, profile badges, and role navigation items.

### 2.6 Adaptive Dark Mode System (`apps/web`)
- Implemented global `ThemeProvider` and `useTheme()` hook with `localStorage` persistence and automatic system preference detection.
- Added comprehensive dark mode CSS variables and styles in `globals.css` with high-contrast background tokens (`#080e18`, `#131d2e`), readable typography, and styled inputs/modals.
- Created reusable `ThemeToggle` button integrated in all portal topbars.
- Bound all dashboard Settings view dark mode checkboxes to `useTheme()`.

### 2.7 Zod Validation Engine (`packages/validations`)
- Configured and built `@research-management/validations` package with full TypeScript declarations.
- Implemented Zod schemas matching Technical Specification v1.0:
  - `auth.ts`: `loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `userProfileSchema`.
  - `organization.ts`: `collegeSchema`, `programSchema`, `academicYearSchema`.
  - `research.ts`: `createResearchSchema`, `updateResearchSchema`, `assignMemberSchema`, `researchTypeSchema`.
  - `workflow.ts`: `createWorkflowSchema`, `workflowStageSchema`, `workflowTransitionSchema`.
  - `forms.ts`: `formSchema`, `formFieldSchema`, `formSubmissionSchema`.
  - `documents.ts`: `uploadDocumentSchema`, `reviewSchema`, `reviewCommentSchema`.
  - `evaluations.ts`: `evaluationTemplateSchema`, `evaluationCriteriaSchema`, `submitEvaluationSchema`.
  - `consultations.ts`: `createConsultationSchema`, `consultationParticipantSchema`, `consultationNoteSchema`.

### 2.8 RBAC & Permission Architecture (`packages/auth`)
- Configured and built `@research-management/auth` package.
- Implemented:
  - `roles.ts`: 8 Institutional Roles (`RESEARCHER`, `ADVISER`, `PANELIST`, `RESEARCH_COORDINATOR`, `RPO`, `REB`, `VPAA`, `SYSTEM_ADMIN`) and 5 Project Roles (`LEADER`, `MEMBER`, `ADVISER`, `PANELIST`, `COORDINATOR`).
  - `permissions.ts`: 34 granular permissions conforming directly to Technical Specification v1.0 Section 7.
  - `role-matrix.ts`: Complete mapping conforming to Section 8.
  - `guards.ts`: `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()`, `getPermissionsForRole()`.

### 2.9 Documentation Standardization
- Replaced default Next.js template readme with comprehensive portal, architecture, and routing documentation in `apps/web/README.md`.

### 2.10 Express REST API & Database Integration (`apps/api`)
- **Express + TypeScript Backend Scaffold:**
  - Initialized Express app with `cors`, `helmet`, `morgan`, `cookie-parser`, and `dotenv`.
  - Configured `@research-management/database` (`PrismaClient`) database connection and query ping.
  - Implemented generic Zod validation middlewares (`validateBody`, `validateQuery`, `validateParams`) integrated with `@research-management/validations`.
  - Implemented JWT authentication and authorization middlewares (`requireAuth`, `requirePermission`, `requireRole`) integrated with `@research-management/auth`.
  - Built core REST API routes:
    - `GET /api/health` — Service uptime & database ping.
    - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` — User authentication, bcrypt hashing, JWT issuance.
    - `GET|POST /api/colleges`, `GET|POST /api/programs`, `GET|POST /api/academic-years` — Configuration endpoints.
    - `GET|POST /api/research`, `GET|PATCH /api/research/:id`, `POST /api/research/:id/members` — Project registry and membership assignment.
    - `GET|POST /api/workflows`, `POST /api/workflows/instances/:id/transition` — Workflow templates and transactional stage advancement.
    - `GET /api/users`, `GET /api/users/:id` — User directory and profile inspection.

### 2.11 Frontend API Integration & Data Fetching Layer (`apps/web` ⇄ `apps/api`)
- **Vite Proxy & Typed API Client:**
  - Configured `apps/web/vite.config.ts` proxying all `/api` endpoints to backend port `5000`.
  - Built `apps/web/src/lib/api-client.ts` with typed methods (`get`, `post`, `patch`, `delete`) and automatic JWT Bearer injection.
- **Global Auth & Session State:**
  - Built `AuthProvider` and `useAuth` hook in `apps/web/src/providers/auth-provider.tsx` with automatic session hydration via `GET /api/auth/me`.
  - Wrapped root app in `AuthProvider` within `apps/web/src/providers/index.tsx`.
- **Live Authentication Flow:**
  - Connected `/login` to `useAuth().login()` with role-based routing and seamless fallback.
- **Live Researcher Dashboard Queries:**
  - Connected `apps/web/src/app/student/dashboard/page.tsx` with TanStack React Query (`/api/research`) and live project metadata updates.

### 2.12 Live Researcher & Adviser Workspaces (`/student` & `/adviser`)
- **Backend Document & Review Engine (`apps/api`):**
  - Implemented `POST /api/research/:researchId/documents` to create and version manuscripts (`v1.0`).
  - Implemented `POST /api/documents/:documentId/versions` for revision workflows (`v2.0`, `v3.0`).
  - Implemented `GET /api/research/:researchId/documents` returning full document histories, versions, and reviewer comments.
  - Implemented `POST /api/documents/versions/:versionId/reviews` for adviser overall recommendations (`APPROVE`, `MINOR_REVISION`, `MAJOR_REVISION`, `REJECT`).
  - Implemented `POST /api/reviews/:reviewId/comments` for inline margin annotations.
- **Frontend Student Workspace Integration (`apps/web`):**
  - Connected `StudentWorkspace.tsx` A4 editor and "1-Tap Submit to System" to live API document endpoints.
- **Frontend Faculty Adviser Portal Integration (`apps/web`):**
  - Connected `adviser/dashboard/page.tsx` to live advisee research projects via React Query.
  - Enabled live milestone approvals and persisted feedback comments.

### 2.13 Defense Panelist Evaluation & Scoring Engine (`/panelist`)
- **Backend Evaluation & Scoring Engine (`apps/api`):**
  - Implemented `GET|POST /api/evaluation-templates` for configuration-driven rubric definitions and criteria weighting (`EvaluationCriterion`).
  - Implemented `POST /api/evaluations` storing panelist evaluation scores, recommendations (`APPROVE`, `MINOR_REVISION`, `MAJOR_REVISION`, `REJECT`), and submission timestamps.
  - Implemented `GET /api/research/:researchId/evaluations` returning consolidated panel scoring records.
- **Frontend Defense Panelist Portal Integration (`apps/web`):**
  - Connected `panelist/dashboard/page.tsx` with live assigned research projects via React Query.
  - Connected digital scoring sheet and recommendation submission button to `/api/evaluations`.

### 2.14 Professor & Coordinator Workflow Builder (`/professor`)
- **Backend Workflow Controls (`apps/api`):**
  - Implemented `PATCH /api/workflows/stages/:stageId` for stage parameters and deadline rules.
  - Implemented `POST /api/workflows/stages/:stageId/toggle-lock` enabling gated milestone progression.
- **Frontend Professor Portal Integration (`apps/web`):**
  - Connected `professor/dashboard/page.tsx` with live research project health stats and workflow milestones.

### 2.15 Institutional Admin & Defense Scheduling (`/admin`)
- **Backend Administrative Operations (`apps/api`):**
  - Implemented `GET /api/admin/metrics` returning live user and active research counts.
  - Implemented `PATCH /api/users/:id/status` for account approvals and suspensions.
  - Implemented `POST /api/certificates` generating completion certificates with verification codes.
- **Frontend Admin Portal Integration (`apps/web`):**
  - Connected `admin/dashboard/page.tsx` user approval actions and project directories to live API endpoints.

### 2.16 System Admin Onboarding & RBAC Governance (`/system-admin`)
- **Backend Organization & Configuration Engine (`apps/api`):**
  - Live configuration endpoints for Colleges, Programs, and Academic Years.
- **Frontend System Admin Portal Integration (`apps/web`):**
  - Connected `system-admin/dashboard/page.tsx` college/program onboarding modals to live database endpoints.

### 2.17 Consultations & Notifications Engine
- **Backend Consultations & Alerts (`apps/api`):**
  - Implemented `GET|POST /api/consultations` for meeting scheduling and participant management.
  - Implemented `GET|POST|PATCH /api/notifications` for in-app alerts and mark-as-read updates.

### 2.18 Real Google Calendar & Meet Integration (`google-calendar.service.ts`)
- Implemented backend Google Calendar API (v3) using `googleapis` with `conferenceDataVersion=1` and `conferenceSolutionKey: { type: "hangoutsMeet" }`.
- Automatically provisions live Google Meet rooms, saving the authentic `meeting_url` directly into PostgreSQL (`consultations.meeting_url`).
- Integrated dynamic fallback to `https://meet.google.com/new` for instant un-scheduled consultations to avoid Google Meet code rejection errors.

### 2.19 Real Google Drive API & Document Versioning (`google-drive.service.ts` & `document.service.ts`)
- Integrated `googleapis` Drive API (v3) (`drive.files.create`, `drive.files.get`, `drive.permissions.create`).
- Configured multipart file upload middleware (`multer` with memory storage) supporting PDF, DOCX, ZIP, and manuscript documents.
- Automatically creates and increments document versions in PostgreSQL, persisting `google_drive_file_id`, storage paths, and version audit trails.

### 2.20 Dynamic Database-Driven JWT & RBAC Matrix
- Enhanced `apps/api/src/middleware/auth.ts` and `rbac.ts` to decode JWT tokens and query active roles and permissions directly from `prisma.userRole`, `prisma.rolePermission`, and `prisma.permission`.
- Enforces dynamic database-driven access control without hardcoded role permissions.

### 2.21 Clean Floating Google Meet Window & Active Session Console
- **Floating JavaScript Popup Handler:**
  ```typescript
  window.open(url, "GoogleMeetWindow", "width=1024,height=720,resizable=yes");
  ```
- **Active Meeting Dashboard UI:**
  - When a consultation or stream conference is launched, the card updates to:
    - 🟢 **"Meeting in Progress"** status with an active pulse indicator.
    - ⏱️ **Live Session Duration Timer** (e.g. `00:45`, `05:12`).
    - 🔄 **"Reopen Meeting Window"** button (brings the popup window back into focus).
    - 🛑 **"End Session"** button (resets timer and restores card to ready state).
- **Side-by-Side Usability:** Main Advisio dashboard remains 100% accessible and interactive while the floating Google Meet window sits cleanly alongside it.

### 2.22 Full Verification & Monorepo Build
- **Clean Turborepo monorepo build** across all workspace packages and apps:
  - `@research-management/auth` (TypeScript)
  - `@research-management/database` (Prisma ORM + PostgreSQL)
  - `@research-management/validations` (Zod Schemas)
  - `api` (Express + TypeScript REST Backend + Google APIs)
  - `web` (Vite 6 + React 19 + TypeScript SPA)
- **Zero compilation errors and full type safety across the entire codebase.**

### 2.23 Production Hardening, Route Protection & Code-Splitting (Post-Sprint Audit)
- **Vite ESLint 9 Flat Config Migration:** Configured `apps/web/eslint.config.mjs` with `typescript-eslint` and fixed all lint errors; verified clean `turbo run lint`.
- **Environment & Security Standardization:** Standardized `.env.example` to `JWT_SECRET`, port `5000`, and Google service account keys.
- **Backend Auth Vulnerability Fix:** Removed insecure unauthenticated user fallback in `apps/api/src/middleware/auth.ts` (`optionalAuth`).
- **Initial Super Admin Seeding:** Added `SYSTEM_ADMIN` (`admin@advisio.edu.ph`), `ADVISER`, and `RESEARCHER` accounts with bcrypt password hashes to `packages/database/src/seed.ts`.
- **Frontend Route Protection:** Created `ProtectedRoute.tsx` enforcing authenticated sessions and RBAC role authorization across all portals.
- **Dynamic Profile Hydration & Real Logout:** Connected `useProfile()` and portal topbars/UserChips directly to `useAuth().user`, and bound all sidebar logout buttons to `logout()` (token removal + redirect).
- **Code-Splitting Optimization:** Converted all portal layouts and dashboard pages in `apps/web/src/routes.tsx` to `React.lazy()`, reducing the initial JS bundle from **611 kB to 289 kB** (a 53% drop).

### 2.24 Multi-User Group Chat API, Traffic Mitigation & Production CI/CD
- **Tamed Consultation Polling:** Relaxed aggressive 1-second interval (`refetchInterval: 1000`) in student and adviser dashboards to 15 seconds with `refetchOnWindowFocus: true`, mitigating 93.3% of redundant database requests.
- **Real Group Chat Backend API:** Created `apps/api/src/routes/chat.routes.ts` mounted at `/api/chats` providing multi-user endpoints for chat group creation, message persistence, and invitations.
- **Frontend Chat Store Sync:** Enhanced `apps/web/src/lib/chat-store.ts` with `fetchRemoteChatStore` and `sendRemoteChatMessage` communicating with `/api/chats`.
- **Containerization (Docker):**
  - Built `apps/api/Dockerfile` on Node 20 Alpine with Prisma client generation and monorepo workspace compilation.
  - Built `apps/web/Dockerfile` with multi-stage build and Nginx runner with SPA client routing (`try_files`) and `/api` proxying.
  - Added `apps/web/nginx.conf` with gzip compression and API reverse proxy.
- **Automated CI/CD Pipeline:** Configured `.github/workflows/ci.yml` running lint, type-check, and builds across all packages on push and pull requests.

### 2.25 Automated Testing Suite & Production Compose Orchestration
- **Vitest Monorepo Test Pipeline:** Configured Turborepo `"test"` task (`turbo run test`) running across packages.
- **RBAC Unit Tests (`@research-management/auth`):** Added `guards.test.ts` verifying permission checks (`hasPermission`, `hasAnyPermission`, `hasAllPermissions`), matrix lookups, and multi-role deduplication (5/5 passed).
- **Zod Validation Unit Tests (`@research-management/validations`):** Added `schemas.test.ts` verifying user credentials, registration constraints, UUIDs, and project role enums (9/9 passed).
- **Continuous Integration Pipeline Enhancement:** Updated `.github/workflows/ci.yml` to automatically execute `npm run test` alongside lint, type-check, and build steps.
- **Production Compose Orchestration (`docker-compose.prod.yml`):** Created full-stack multi-container composition orchestrating `postgres` (healthchecked), `api` (Express production container), and `web` (Nginx static + reverse proxy container) on a unified bridge network.

### 2.26 Baseline Database Migration & Version Control (`packages/database`)
- **Prisma Migration Baseline (`20260905000000_init`):** Generated the complete 886-line PostgreSQL DDL migration script covering all schemas, extensions (`citext`, `pgcrypto`), enums, tables, and foreign keys.
- **Migration Tracking Lock (`migration_lock.toml`):** Configured Prisma migration tracking provider for PostgreSQL, establishing deterministic and reproducible deployments via `npx prisma migrate deploy` in production and CI environments.

### 2.27 Real-Time Server-Sent Events (SSE) Engine (`apps/api` & `apps/web`)
- **SSE Connection Manager (`apps/api/src/realtime/sse.ts`):** Implemented high-performance event streaming manager with keep-alive heartbeat pings (every 25s), targeted user messaging, and global room broadcasting.
- **Realtime Endpoint (`GET /api/realtime/events`):** Mounted SSE streaming route with Nginx buffer bypass headers (`X-Accel-Buffering: no`) and active metrics endpoint (`GET /api/realtime/status`).
- **Realtime Chat Sync:** Wired `chat:message`, `chat:created`, and `chat:invitation` SSE broadcasts directly into `chat.routes.ts`.
- **Browser SSE Client (`apps/web/src/lib/realtime/sse-client.ts`):** Created auto-reconnecting browser EventSource client and subscribed `chat-store.ts` for instantaneous, zero-latency multi-client message delivery.

### 2.28 Transactional Email Engine (`@research-management/email`)
- **Production HTML Templates:** Built responsive, institutionally branded email templates for user provisioning (`renderWelcomeEmail`) and defense sessions (`renderDefenseScheduledEmail`).
- **Resend API Integration & Fallback:** Implemented delivery client sending via Resend API when `RESEND_API_KEY` is present, with safe mock console delivery fallback for local dev and automated tests.
- **Full Monorepo Automated Test Suite:** Expanded test suite across 4 packages (`auth`, `validations`, `email`, and `api`).

### 2.29 Deployment Runbook & Native React Product Tour
- **Production Runbook (`DEPLOYMENT.md`):** Published a comprehensive production guide detailing single-command Docker deployment (`docker-compose.prod.yml`), bare-metal Nginx reverse proxy + SSL configuration, database migrations (`npx prisma migrate deploy`), health probe verification, backup/restore procedures, and troubleshooting.
- **Native React Product Tour (`ProductTour.tsx`):** Engineered a high-polish, accessible guided onboarding tour component featuring spotlight cutouts, keyboard navigation (Escape, arrows), and `localStorage` persistence. Integrated directly into the Student Dashboard with trigger buttons across key tabs (`overview`, `workspace`, `submissions`, `consultations`, `milestones`, `chat`).

---

## 3. Platform Status: PRODUCTION-READY (Hardened, Tested & Orchestrated)

| Sprint | Description | Status |
|---|---|---|
| **Sprint 1** | Frontend SPA & Layout Standardization (`apps/web`) | ✅ COMPLETED |
| **Sprint 2** | Express REST API & Database Integration (`apps/api`) | ✅ COMPLETED |
| **Sprint 3** | Frontend API Integration & Data Fetching Layer (`apps/web` ⇄ `apps/api`) | ✅ COMPLETED |
| **Sprint 4** | Live Researcher & Adviser Workspaces (`/student` & `/adviser`) | ✅ COMPLETED |
| **Sprint 5** | Defense Panelist Evaluation & Scoring Engine (`/panelist`) | ✅ COMPLETED |
| **Sprint 6** | Professor & Coordinator Workflow Builder (`/professor`) | ✅ COMPLETED |
| **Sprint 7** | Institutional Admin & Defense Scheduling (`/admin`) | ✅ COMPLETED |
| **Sprint 8** | System Admin Onboarding & RBAC Governance (`/system-admin`) | ✅ COMPLETED |
| **Sprint 9** | Consultations, Google Meet & Drive Integrations | ✅ COMPLETED |
| **Sprint 10** | Full Monorepo Build, Type Verification & Master Alignment | ✅ COMPLETED |

---

## 4. Operational Rules

1. **Automatic Plan Updates:** Automatically update this `plan.md` file upon the completion of any major sprint milestone or architectural decision to maintain an accurate, audit-ready source of truth.
2. **Configuration-First Principle:** Never hardcode institutional rules, colleges, or workflows in code. All workflows, stages, forms, and permission assignments must be database-driven operations.
3. **Spec Alignment:** All database entities, API endpoints, and permission matrices map directly to **Technical Specification v1.0**.
