# Advisio - Research, Advising & Management Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.9-EF4444.svg)](https://turbo.build/)

**Advisio** is an institutional-grade research and capstone management platform built to streamline academic thesis lifecycle management, faculty advising, manuscript submissions, panel defense scheduling, rubric evaluation, and institutional reporting.

---

## 📑 Table of Contents
1. [System Architecture & Monorepo Structure](#-system-architecture--monorepo-structure)
2. [Key Features](#-key-features)
3. [Quickstart & Development Setup](#-quickstart--development-setup)
4. [Demo Accounts & Test Credentials](#-demo-accounts--test-credentials)
5. [Database Management & Prisma](#-database-management--prisma)
6. [Environment Variables Guide](#-environment-variables-guide)
7. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 🏛 System Architecture & Monorepo Structure

The project is structured as a high-performance **Turborepo** monorepo:

```text
Advisio_Prototype_Updated/
├── apps/
│   ├── web/                     # React 18 + Vite + TypeScript + Tailwind CSS Frontend
│   │   ├── src/
│   │   │   ├── app/             # Role Portals (Student, Adviser, Panelist, Professor/Dean, System Admin)
│   │   │   ├── components/      # UI Components, Dashboards, Gantt Charts, Notifications
│   │   │   ├── hooks/           # Data & Query hooks (React Query)
│   │   │   ├── lib/             # API client, workflow progress calculations, storage
│   │   │   └── providers/       # AuthProvider, QueryClientProvider
│   │   └── vite.config.ts
│   │
│   └── api/                     # Node.js + Express + TypeScript Backend
│       ├── src/
│       │   ├── routes/          # Research, Live Defense, Adviser Requests, Workflow, Documents, Auth
│       │   ├── middleware/      # JWT Authentication & RBAC Permission Guards
│       │   ├── services/        # Google Drive, Calendar, Notifications, Email
│       │   └── lib/prisma.ts    # Centralized Prisma Client
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
- 🔔 **Real-Time Notification Popover & Alerts**: Instant updates on adviser acceptance, submission reviews, task deadlines, and defense schedules.
- 🏛️ **College & Department Customization**: Manage colleges (CIT, etc.), academic programs (BSIT, BSCS, etc.), dynamic forms, and institutional workflow stages.

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

*(The default `.env` is pre-configured to connect to the local Docker PostgreSQL database out of the box).*

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
# Navigate to database package
cd packages/database

# Push schema and apply migrations
npx prisma db push

# Seed the database with demo users & projects
npx tsx src/seed.ts

# Return to repository root
cd ../..
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

| Role | Email | Default Password | Description |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@advisio.edu.ph` | `Admin@12345` | System configuration, colleges, audit logs |
| **System Administrator (Alt)** | `superadmin01@university.edu.ph` | `password123` | Backup Super Admin account |
| **College Dean / Coordinator** | `dean@advisio.edu.ph` | `password123` | Institutional milestones, approvals & defense scheduling |
| **Faculty Adviser** | `adviser@advisio.edu.ph` | `Adviser@12345` | Manuscript reviews, student advising requests |
| **Faculty Adviser (Alt)** | `adviser01@university.edu.ph` | `password123` | Faculty adviser demo account |
| **Defense Panelist** | `panelist01@university.edu.ph` | `password123` | Live defense evaluation & rubric scoring |
| **Student / Researcher** | `student@advisio.edu.ph` | `Student@12345` | Capstone project leader, tasks, document submissions |
| **Student / Researcher (Alt)** | `student01@university.edu.ph` | `password123` | Student researcher demo account |

---

## 🛠 Database Management & Prisma

Useful commands when working with the database:

```bash
# View and edit database records in Prisma Studio GUI
cd packages/database
npx prisma studio

# Reset and re-seed the entire database from scratch
npx prisma db push --force-reset
npx tsx src/seed.ts
```

---

## ⚙️ Environment Variables Guide

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://advisio_local:advisio_local_password@127.0.0.1:5433/advisio_local?schema=public` |
| `JWT_SECRET` | Secret key used to sign JWT auth tokens | `advisio-super-secret-key-change-in-production` |
| `PORT` | API server listen port | `5000` |
| `API_URL` | Backend URL | `http://localhost:5000` |
| `WEB_URL` | Frontend URL | `http://localhost:3000` |
| `CORS_ORIGIN` | Allowed origin for CORS headers | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for Drive/Calendar integration) | *(Optional)* |
| `GOOGLE_CLIENT_SECRET`| Google OAuth client secret | *(Optional)* |
| `GOOGLE_REFRESH_TOKEN`| Google OAuth refresh token | *(Optional)* |

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

---

## 📄 License
Internal Institutional Project. All rights reserved.
