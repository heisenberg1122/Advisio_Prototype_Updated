# Advisio Web Portal (`apps/web`)

> **Client Application** for the Advisio Research, Advising, and Management Platform.  
> Built with **Vite 6 + React 19 + TypeScript + React Router v6 + Tailwind CSS v4**.

---

## 1. Overview & Portals

Advisio provides dedicated, role-tailored dashboards and workspace environments for academic research governance:

| Route | Role | Description |
|---|---|---|
| `/student/*` | **Researcher / Student** | Research group workspace, manuscript submission, milestone progress, and consultation requests. |
| `/adviser/*` | **Faculty Adviser** | Advisee tracking, inline document reviews, commenting, consultation scheduling, and milestone approvals. |
| `/panelist/*` | **Defense Panelist** | Defense session schedule, manuscript evaluation, digital scoring sheets, and grading records. |
| `/professor/*` | **Course Professor** | Blank-canvas task builder, project progress monitoring, progression deployment, and milestone locking. |
| `/admin/*` | **Institutional Admin** | User account management, defense panel assignments, deadline calendar, and completion certificate generation. |
| `/system-admin/*` | **System Administrator** | College/program onboarding, global RBAC matrix oversight, audit logs, and maintenance. |

---

## 2. Key Features

- **Configuration-Driven Design**: Dynamic workflows and navigation tabs driven by parameters rather than hardcoded rules.
- **Adaptive Dark Mode**: Global theme provider with automatic OS detection, local storage persistence, and topbar/settings quick toggles.
- **Collapsible Navigation**: Responsive two-column sidebar layout with animated transition between expanded (`240px`) and collapsed (`64px`) states.
- **Tabler Icons & Google Fonts**: Institutional typography (Inter) paired with Tabler icon webfonts.

---

## 3. Getting Started

### Prerequisites
- Node.js `>= 20.0.0`
- npm `>= 10.0.0`

### Running the Frontend
From the root directory:
```bash
# Start all workspaces in dev mode
npm run dev

# Or start only the web application
npm run dev --workspace=web
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

### Building for Production
```bash
npm run build --workspace=web
```

---

## 4. Architecture & Directory Structure

```text
apps/web/
├── src/
│   ├── app/                    # Portal views & layouts
│   │   ├── (public)/           # Login, Register, Forgot Password
│   │   ├── student/            # Researcher Portal
│   │   ├── adviser/            # Faculty Adviser Portal
│   │   ├── panelist/           # Defense Panelist Portal
│   │   ├── professor/          # Professor / Coordinator Portal
│   │   ├── admin/              # Institutional Admin Portal
│   │   ├── system-admin/       # System Admin Portal
│   │   └── globals.css         # Tailwind v4 design system & dark mode tokens
│   ├── components/             # Reusable UI component modules
│   │   ├── dashboards/         # Role-specific topbars & sidebars
│   │   ├── shared/             # ThemeToggle, NavItem, UserChip
│   │   └── ui/                 # Buttons, Cards, Tags, Modals
│   ├── hooks/                  # Custom React hooks (notifications, profile, sidebar)
│   ├── lib/                    # Utilities and router compatibility bridge
│   ├── providers/              # React Query & Theme providers
│   ├── routes.tsx              # React Router v6 routing table
│   ├── App.tsx                 # Root application component
│   └── main.tsx                # SPA entry point
├── index.html                  # HTML template
└── vite.config.ts              # Vite configuration
```
