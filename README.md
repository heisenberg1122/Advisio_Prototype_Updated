# Advisio - Research, Advising & Management Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.3-EF4444.svg)](https://turbo.build/)

**Advisio** is an institutional-grade research and capstone management platform built to streamline academic thesis lifecycle management, faculty advising, manuscript submissions, panel defense scheduling, rubric evaluation, and institutional reporting.

---

## 📑 Table of Contents

1. [System Architecture & Monorepo Structure](#-system-architecture--monorepo-structure)
2. [Key Features](#-key-features)
3. [Researcher Workflow Invitations & Monitoring](#-researcher-workflow-invitations--monitoring)
4. [Internal Inbox & Dean Approval Workflow](#-internal-inbox--dean-approval-workflow)
5. [Secure Document Signatures](#-secure-document-signatures)
6. [Quickstart & Development Setup](#-quickstart--development-setup)
7. [Demo Accounts & Test Credentials](#-demo-accounts--test-credentials)
8. [Database Management & Prisma](#-database-management--prisma)
9. [Environment Variables Guide](#-environment-variables-guide)
10. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 🏛 System Architecture & Monorepo Structure

The project is structured as a high-performance **Turborepo** monorepo:

```text
Advisio_Prototype_Updated/
├── apps/
│   ├── web/                     # React 19 + Vite 6 + TypeScript + Tailwind CSS 4 frontend
│   │   ├── src/
│   │   │   ├── app/             # Role Portals (Student, Adviser, Panelist, Professor/Dean, System Admin)
│   │   │   ├── components/      # UI, dashboards, consultations, grading, and notifications
│   │   │   ├── hooks/           # Data & Query hooks (React Query)
│   │   │   ├── lib/             # API client, workflow progress calculations, storage
│   │   │   └── providers/       # AuthProvider, QueryClientProvider
│   │   └── vite.config.ts
│   │
│   └── api/                     # Node.js + Express + TypeScript Backend
│       ├── src/
│       │   ├── routes/          # Research, defense, calendar, chat, workflow, documents, auth
│       │   ├── middleware/      # JWT Authentication & RBAC Permission Guards
│       │   ├── services/        # Google Drive, Calendar, Notifications, Email
│       │   ├── realtime/        # Server-sent event infrastructure
│       │   └── lib/prisma.ts    # Centralized Prisma client
│       └── uploads/             # Temporary local storage for document uploads
│
├── packages/
│   ├── database/                # Prisma schema, PostgreSQL migrations & Comprehensive Seed
│   ├── auth/                    # Institutional Roles & Granular Permission Matrix (33+ permissions)
│   ├── validations/             # Zod validation schemas across all modules
│   ├── email/                   # Email notifications & templates
│   └── shared/                  # Common TypeScript interfaces & constants
│
├── docker-compose.yml           # PostgreSQL 16 local database service
├── turbo.json                   # Build and pipeline orchestration
└── package.json                 # Monorepo workspaces configuration
```

---

## ✨ Key Features

- 🎓 **Multi-Role Portals**: Dedicated workspaces for **Students/Researchers**, **Faculty Advisers**, **Defense Panelists**, **Research Coordinators / Deans**, and **System Administrators**.
- 📊 **Interactive Gantt Chart & Task Board**: Milestone-based task breakdown, progress tracking, and deliverables management.
- 👨‍🏫 **Adviser Pool & Request System**: Filter advisers by specialization and slot availability, submit advising proposals, and track request status in real-time.
- ⚖️ **Live Defense & Rubric Scoring**: Panel defense scheduling, live scoring matrices, deliberation comments, and institutional grading.
- 📁 **Document Repository & Version Control**: Multi-version manuscript uploads, cloud sync with Google Drive, and revision history.
- ✍️ **Role-Scoped Electronic Signatures**: Advisers, professors, panelists, and deans can review and sign eligible PDFs using password confirmation, immutable signed versions, verification codes, file hashes, and audit logs.
- 🗂️ **Research Group Files**: Folder-based collaborative storage with controlled promotion into the formal document and review lifecycle.
- 🔔 **Real-Time Notification Popover & Alerts**: Instant updates on adviser acceptance, submission reviews, task deadlines, and defense schedules.
- 📅 **Role-Scoped Universal Calendar**: Shared academic scheduling with visibility and actions tailored to each role.
- 💬 **Consultations & Group Chat**: Consultation booking, meeting history, embedded sessions, and research-group conversations.
- 📬 **Role-Scoped Internal Inbox**: Researchers, advisers, panelists, professors, deans, and system administrators can exchange threaded messages, save drafts, reply, and securely send or download attachments.
- 📨 **Dean Defense Approval Requests**: Professors can send a defense-approval PDF directly to the correct dean, with the recipient's name shown before submission and each dean seeing only requests addressed to them.
- ☁️ **Pluggable Document Storage**: Google Drive integration, optional Supabase storage, and a configurable local fallback.
- 🏛️ **College & Department Customization**: Manage colleges (CIT, etc.), academic programs (BSIT, BSCS, etc.), dynamic forms, and institutional workflow stages.

---

## 🔗 Research Workflow Authoring, Participants & Monitoring

The Professor Dashboard uses a simplified, Google Classroom-inspired workflow workspace. Selecting a research workflow opens three contextual tabs: **Workflow**, **Guides & Templates**, and **Participants**. The Workflow tab shows the milestone sequence immediately, while a single **Create** menu provides submission milestones, approval checkpoints, academic events, and workflow-wide guides or templates.

Milestones are created and edited through the same focused composer. The primary area contains the milestone title, student instructions, and submission requirements; completion mode, relative target duration, approval gating, and advanced milestone type settings remain in a secondary panel. New workflows continue to use relative durations so the same workflow can be reused without hardcoded calendar dates.

Professors can generate a workflow invitation code and share its direct link with researchers. Invitation links are authentication-protected: a signed-out visitor is sent to the login page, and a successful researcher login returns the user to the original invitation. The invitation preview identifies the workflow and professor before the researcher chooses **Accept** or **Reject**.

After acceptance, the researcher is sent directly to **Tasks & Requirements**, where the accepted workflow is shown as the active workflow. Researchers can also enter a professor-provided invitation code from that page and review the same confirmation screen before joining. Joined workflows remain visible before project registration, while task submission becomes available after a research project is registered and linked.

Each workflow maintains its own participant roster. For example, **BSIT 4A CAPSTONE** and **BSIT 4B CAPSTONE** display separate participant counts and lists even when both are managed by the same professor. The Participants tab shows only **Name**, **Student number**, **Email**, and **Joined**, with search and invitation controls above the table. Selecting a participant opens enrollment details and the removal action.

The Professor Dashboard separates workflow enrollment from project monitoring:

- **Workflow → Participants** manages invitations, the workflow-specific researcher roster, and enrollment removal.
- **Research Projects** provides the professor's combined project view across workflows; the former duplicate researcher roster has been removed from this section.
- Removing a **participant** revokes only that researcher's enrollment in the selected workflow. Existing project membership and submitted academic records are preserved.
- Removing a **project** detaches only its workflow assignment and removes it from active professor workflow monitoring. It does not archive or delete the research project.
- The researcher retains access to the project, members, documents, submissions, and other academic records from the Researcher Dashboard.
- Every participant removal requires a written reason between 5 and 500 characters. The API records the reason together with the workflow name, researcher identity, student number, email, enrollment status, and original joining date in the audit log. The removed researcher also receives the reason in their notification.

This separation prevents workflow administration from accidentally deleting or hiding a researcher's underlying project data.

---

## 📬 Internal Inbox & Dean Approval Workflow

Every role portal includes an internal Inbox with **Inbox**, **Sent**, and **Drafts** folders. Users can compose messages, select an active recipient by name and role, continue a threaded conversation, and attach up to five files with a maximum size of 10 MB per file. Mail threads and attachment downloads are authorization-scoped to their participants.

The Researcher Inbox intentionally contains only the standard messaging experience; it does not expose electronic-signature controls. Research group chat remains a separate feature for group collaboration.

The Dean portal separates regular communication from formal approval work:

- **Inbox** contains ordinary internal messages.
- **Signature Requests** contains defense-approval documents submitted by professors.
- A professor chooses the eligible research group and addressed dean, writes a message, and uploads the PDF requiring approval.
- The dean reviews the exact PDF, adjusts its zoom and signature placement, signs it, and sends a reply. Signing creates a new immutable file version and preserves the original.

Inbox data is stored in `MailThread`, `MailParticipant`, `MailMessage`, and `MailAttachment`. Dean requests are recipient-specific, so requests are segregated between different dean accounts rather than being shown in a shared global queue.

The related schema changes are included in these migrations:

- `packages/database/prisma/migrations/20261007020000_dean_inbox`
- `packages/database/prisma/migrations/20261007030000_dean_inbox_recipient`
- `packages/database/prisma/migrations/20261007040000_internal_mail`

---

## 📑 Panelist Defense Review Packets

Research coordinators can publish a defense packet after a group is eligible and scheduled for defense. A packet identifies the approved manuscript version, an optional similarity report, a review deadline, and optional recommendation and evaluation PDF templates. Only accepted panelists can open a published packet.

The panelist workspace provides an authenticated PDF reader, manuscript version history, page-specific comments, private notes, a required-revision checklist, tracked downloads, recommendation drafting, and live rubric scoring. Private review material remains scoped to its author.

Professors map web-form values to PDF templates using page numbers and normalized coordinates. Final recommendation and evaluation submissions generate immutable PDFs; the panelist can then apply their private signature through the standard document-signing workflow. The migration is located at `packages/database/prisma/migrations/20261008010000_defense_review_packets`.

Mappings define a complete bounding box, preferred and minimum font sizes, alignment, and an overflow policy. The generation engine never silently truncates a response: content either fits, shrinks within the configured readable limit, moves to an appended continuation page, or blocks generation. Recommendation drafts must produce a current private preview before the panelist can confirm and lock the official PDF; any edit invalidates the earlier preview. Generation reports preserve field-level fit, shrink, wrap, and appendix decisions.

---

## ✍️ Secure Document Signatures

Advisio treats a signature as a final academic or institutional decision—not as a routine document comment. Every signing action requires the signer to review the exact PDF version, position a private PNG signature, confirm the action, and re-enter their password.

| Signer | Intended signing point |
| :--- | :--- |
| **Faculty Adviser** | After manuscript review is complete and the document is endorsed for the next workflow gate |
| **Course Professor / Research Coordinator** | After milestone evidence or defense-readiness requirements have been verified |
| **Defense Panelist** | After the panelist's final evaluation and recommendation have been submitted and locked |
| **Dean / Institutional Approver** | After all prerequisite faculty and panel endorsements are complete and the institutional decision is final |

Signing never overwrites the uploaded manuscript. The API creates a new PDF version and records the signer, signing time, role-specific verification code, original and signed SHA-256 hashes, placement data, and authentication method. Signed outputs can be countersigned in sequence, preserving the earlier signatures and the full version chain.

Signature images are private, limited to valid PNG files up to 2 MB, and served only to the authenticated owner. Authorization is checked again by the API against the signer's institutional role and research scope; panelist signatures additionally require a locked final evaluation.

The schema changes are included in `packages/database/prisma/migrations/20261007010000_document_signatures`. Apply migrations before testing the signing workflow against an existing database.

---

## 🚀 Quickstart & Development Setup

Follow these steps to run Advisio locally on your machine.

### 1. Prerequisites

- **Node.js**: `v20.x` or higher ([Download Node.js](https://nodejs.org/))
- **npm**: `v10.x` or higher (bundled with Node.js)
- **Docker Desktop** (Recommended for 1-click database) OR local **PostgreSQL 16**

---

### 2. Clone the Repository

```bash
git clone https://github.com/heisenberg1122/Advisio_Prototype_Updated.git
cd Advisio_Prototype_Updated
```

---

### 3. Environment Setup

Copy `.env.example` to `.env` in the root folder and inside `packages/database/`:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
Copy-Item packages\database\.env.example packages\database\.env
```

**macOS / Linux / Bash:**

```bash
cp .env.example .env
cp packages/database/.env.example packages/database/.env
```

_(The default `.env` is pre-configured to connect to the local Docker PostgreSQL database out of the box)._

---

### 4. Start Local PostgreSQL Database

Using **Docker Compose** (recommended):

```bash
docker compose up -d
```

> This starts PostgreSQL 16 on port `5433` (avoiding port conflicts with standard port 5432) with database `advisio_local`.

---

### 5. Install Dependencies & Build Packages

```bash
# Install all workspace dependencies
npm install

# Build shared packages (auth, validations, database client)
npm run build
```

---

### 6. Run Database Migrations & Seed Sample Data

Populate the database with institutional roles, demo users, sample research projects, workflows, defense sessions, and announcements:

```bash
# From the repository root, apply committed migrations in a deployed environment
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

# Seed sample data
npm run db:seed
```

---

### 7. Start the Development Servers

```bash
npm run dev
```

The system will start both the frontend and backend servers concurrently:

- 🌐 **Web Application**: `http://localhost:3000`
- ⚙️ **Backend API**: `http://localhost:5000`
- 🩺 **API Health Check**: `http://localhost:5000/api/health`

---

## 🔑 Demo Accounts & Test Credentials

The database seed provides ready-to-use accounts for each institutional role:

| Role                           | Email                            | Default Password | Description                                              |
| :----------------------------- | :------------------------------- | :--------------- | :------------------------------------------------------- |
| **System Administrator**       | `admin@advisio.edu.ph`           | `Admin@12345`    | System configuration, colleges, audit logs               |
| **System Administrator (Alt)** | `superadmin01@university.edu.ph` | `password123`    | Backup Super Admin account                               |
| **College Dean / Coordinator** | `dean@advisio.edu.ph`            | `password123`    | Institutional milestones, approvals & defense scheduling |
| **Faculty Adviser**            | `adviser@advisio.edu.ph`         | `Adviser@12345`  | Manuscript reviews, student advising requests            |
| **Faculty Adviser (Alt)**      | `adviser01@university.edu.ph`    | `password123`    | Faculty adviser demo account                             |
| **Defense Panelist**           | `panelist01@university.edu.ph`   | `password123`    | Live defense evaluation & rubric scoring                 |
| **Course Professor**           | `professor01@university.edu.ph`  | `password123`    | Workflow deployment and student progress monitoring      |
| **Student / Researcher**       | `student@advisio.edu.ph`         | `Student@12345`  | Capstone project leader, tasks, document submissions     |
| **Student / Researcher (Alt)** | `student01@university.edu.ph`    | `password123`    | Student researcher demo account                          |

---

## 🛠 Database Management & Prisma

Useful commands when working with the database:

```bash
# View and edit database records in Prisma Studio GUI
cd packages/database
npx prisma studio

# Reset and re-seed the entire database from scratch
npx prisma db push --force-reset
npm run db:push
npm run db:seed
```

---

## ⚙️ Environment Variables Guide

| Variable                                                   | Description                                             | Default / Example                                                                              |
| :--------------------------------------------------------- | :------------------------------------------------------ | :--------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                             | PostgreSQL connection string                            | `postgresql://advisio_local:advisio_local_password@127.0.0.1:5433/advisio_local?schema=public` |
| `DIRECT_URL`                                               | Direct PostgreSQL connection used by Prisma             | Same as `DATABASE_URL` locally                                                                 |
| `JWT_SECRET` / `AUTH_SECRET`                               | Secrets used for authentication and JWT signing         | Replace both in production                                                                     |
| `PORT`                                                     | API server listen port                                  | `5000`                                                                                         |
| `API_URL`                                                  | Backend URL                                             | `http://localhost:5000`                                                                        |
| `WEB_URL`                                                  | Frontend URL                                            | `http://localhost:3000`                                                                        |
| `CORS_ORIGIN`                                              | Allowed origin for CORS headers                         | `http://localhost:3000`                                                                        |
| `GOOGLE_CLIENT_ID`                                         | Google OAuth client ID (for Drive/Calendar integration) | _(Optional)_                                                                                   |
| `GOOGLE_CLIENT_SECRET`                                     | Google OAuth client secret                              | _(Optional)_                                                                                   |
| `GOOGLE_REFRESH_TOKEN`                                     | Google OAuth refresh token                              | _(Optional)_                                                                                   |
| `GOOGLE_REDIRECT_URI`                                      | OAuth callback URI                                      | _(Optional)_                                                                                   |
| `GOOGLE_DRIVE_FOLDER_ID`                                   | Parent Drive folder for managed documents               | _(Optional)_                                                                                   |
| `GOOGLE_CALENDAR_ID`                                       | Calendar used for scheduled events                      | `primary`                                                                                      |
| `STORAGE_PROVIDER`                                         | Primary document storage provider                       | `GOOGLE_DRIVE`                                                                                 |
| `INTEGRATION_ENCRYPTION_KEY`                               | Encrypts stored integration credentials                 | Replace in production                                                                          |
| `ALLOW_LOCAL_STORAGE_FALLBACK`                             | Allows local uploads when cloud storage is unavailable  | `false`                                                                                        |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` | SMTP delivery configuration                             | Mailtrap-compatible defaults                                                                   |
| `RESEND_API_KEY`                                           | Resend email provider API key                           | _(Optional)_                                                                                   |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                | Supabase credentials when using Supabase storage        | _(Optional)_                                                                                   |
| `SUPABASE_STORAGE_BUCKET`                                  | Supabase bucket used for manuscripts                    | `manuscripts`                                                                                  |
| `EMAIL_FROM`                                               | Sender name and address for notification emails         | `Advisio Notifications <notifications@advisio.edu.ph>`                                         |

See [`.env.example`](.env.example) for the local starter template. Deployment-specific settings and production Compose instructions are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## ❓ Troubleshooting & FAQ

### 1. Database Connection Error (`P1001` or Connection Refused)

- Ensure Docker Desktop is running.
- Run `docker compose ps` to verify the `advisio-postgres` container is healthy on port `5433`.
- If using an external PostgreSQL instance, update `DATABASE_URL` in `.env` and `packages/database/.env`.

### 2. Port `3000` or `5000` Already in Use

- Check for running processes on ports 3000/5000 and terminate them, or update the `PORT` in `.env` and `apps/web/vite.config.ts`.

### 3. Missing Prisma Client or Module Import Errors

- Re-run `npm run build` from the repository root to regenerate the Prisma client and shared build outputs.

### 4. Signature Button Is Not Available

- Confirm that the current file is a PDF and belongs to a research project within the signed-in user's scope.
- Panelists must submit and lock their final evaluation before signing.
- Apply the document-signature migration and regenerate the Prisma client after pulling schema changes.

### 5. Inbox Is Empty After Sending a Message or Dean Request

- Confirm that the sender selected the intended recipient account; inboxes and signature queues are recipient-specific.
- Use **Inbox** for ordinary messages and **Signature Requests** for formal Dean approval documents.
- Apply the latest Prisma migrations and regenerate the Prisma client after pulling schema changes.
- Restart both development servers so the new API routes and generated database client are loaded.

---

## 📄 License

Internal Institutional Project. All rights reserved.
