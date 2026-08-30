# Advisio — Research, Advising & Management Platform

This repository contains the full-stack monorepo for **Advisio** (Research Management System), transitioned from the prototype into a production-capable thesis system conforming to **Technical Specification v1.0**.

---

## ??? System Architecture & Monorepo Structure

```text
research-management-system/
¦
+-- apps/
¦   +-- web/                     # React + TypeScript Frontend Web Application
¦   ¦   +-- src/
¦   ¦   ¦   +-- app/             # Role Portals: Student, Adviser, Panelist, Professor, Admin
¦   ¦   ¦   +-- components/      # UI, Dashboards, Consultations & Writing Workspace
¦   ¦   ¦   +-- lib/             # API Client, Router compatibility & State store
¦   ¦   ¦   +-- providers/       # Auth & Query Providers
¦   ¦   +-- vite.config.ts
¦   ¦
¦   +-- api/                     # Node.js + Express + TypeScript Backend API
¦       +-- src/
¦           +-- routes/          # Research, Consultations, Users, Workflows, Auth, Evaluations
¦           +-- middleware/      # RBAC, Authentication & Validation filters
¦           +-- services/        # Google Calendar/Meet & Drive integrations
¦           +-- lib/prisma.ts    # Prisma ORM client
¦
+-- packages/
¦   +-- database/                # Prisma ORM schema, PostgreSQL migrations & seeds
¦   +-- auth/                    # Institutional Roles (8) & Granular Permissions (33)
¦   +-- validations/             # Zod validation schemas
¦   +-- email/                   # SMTP transport
¦   +-- shared/                  # Shared models & utilities
¦
+-- turbo.json                   # Turborepo build pipeline
+-- package.json                 # Monorepo workspaces
```

---

## ?? Quickstart & Development

### 1. Prerequisites
- Node.js >= 20
- PostgreSQL (Port 5432)

### 2. Install Dependencies
```bash
npm install
```

### 3. Build Shared Packages
```bash
npm run build
```

### 4. Database Setup & Seed
```bash
cd packages/database
npx prisma db push
npx tsx src/seed.ts
```

### 5. Run Development Servers
```bash
npm run dev
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`
- **API Health Check**: `http://localhost:5000/api/health`

---

## ?? Institutional Roles & RBAC Matrix

- **RESEARCHER / STUDENT**: Personal tasks, workspace, consultations, submissions.
- **PROJECT LEADER**: Member management, team task assignments, group contributions.
- **ADVISER**: Manuscript reviews, annotations, consultation meetings, approvals.
- **PANELIST**: Defense scoring, evaluation rubric criteria, recommendations.
- **RESEARCH COORDINATOR**: Departmental milestones, tracking, adviser/panelist allocation.
- **RPO / RESEARCH OFFICE**: Institutional repository, ethics monitoring, archives.
- **REB (Ethics Board)**: Ethical reviews, revision requests, clearances, certificates.
- **VPAAc**: Institutional research statistics, executive overview & approvals.
- **SYSTEM ADMIN**: College, program, research type, dynamic forms & workflow configuration.
