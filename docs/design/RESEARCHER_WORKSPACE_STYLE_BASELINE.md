# ADVISIO — Researcher Workspace Design Baseline

> **Baseline captured:** 2026-11-07, `main` at commit [`133b501`](https://github.com/heisenberg1122/Advisio_Prototype_Updated/commit/133b501d875e14ed63477c3e81d143e9e197c678).  
> **Status:** Reuse/reference contract, **not** a new runtime stylesheet.  
> **Scope:** Finish and harmonize Researcher screens first; other academic roles can inherit the same *shared shell and semantic tokens* without becoming exact copies of the Researcher dashboard.  
> **Change policy:** No changes to the running TAM/evaluation application, data, authorization, routes, API, or deployment.

## 1. What is approved about the new design

**Visual principle: institutionally branded workspace + calm neutral work surfaces.**

- **Home:** A college-themed, readable hero with a faint grayscale seal, compact researcher identity, progress ring, and milestone journey. Immediately after it: **one** actionable next-step row. The **Coming up** and **Latest updates** cards sit side by side at equal heights on desktop and stack on narrow screens.
- **Project Overview:** Soft college-tinted cover; concise project status/title; team/adviser information; compact edit controls and optional abstract. Give the user one next action, one milestone-progress summary, clean lists, and human-readable dates.
- **Group & Members:** Same understated tinted cover, **members first**, small per-member action menu, Invite expanded only when requested, and advanced access settings collapsed.
- **Across all pages:** Balanced whitespace, easily scanned section headings, purposeful empty states, clearly named actions, one primary CTA per task, and reduced visual noise.
- **Do not** paste the Home hero, progress ring, milestone timeline, or branded background into every page. Repeat the *design language*, not every widget.

These are observed code decisions, not confirmation of a browser screenshot or production deployment.

## 2. Single source of truth — inspect these files before editing

| Role | Source file(s) | What to reuse |
| --- | --- | --- |
| Global theme tokens | `apps/web/src/app/globals.css`, `apps/web/src/lib/college-themes.ts`, `apps/web/src/providers/theme-provider.tsx` | Semantic light/dark and per-college variables |
| Shared page shell | `apps/web/src/components/layout/AppWorkspaceFrame.tsx`, `apps/web/src/components/layout/workspace-layout.css` | Sidebar/topbar/content relationship, outer radii, width/gutters, responsive layout and transitions |
| Researcher shell + neutral surfaces | `apps/web/src/app/student/layout.tsx`, `apps/web/src/app/student/researcher-workspace-surfaces.css` | Shared Researcher navigation and light/dark content surface behavior |
| Researcher sidebar and topbar | `apps/web/src/components/dashboards/student/StudentSidebar.tsx`, `StudentTopbar.tsx`, `apps/web/src/components/layout/AppSidebar.tsx` | Grouped navigation, active states, responsive collapse, page title, toolbar |
| Home composition | `apps/web/src/app/student/dashboard/page.tsx` | `overview` view with `research-command-center researcher-home`; **do not style the legacy overview instead** |
| Home components | `apps/web/src/components/dashboards/student/overview/ResearcherHome.tsx`, `researcher-home.css`, `research-command-center.css` | Hero, next-step strip, equal-height updates/coming-up cards, workflow accordion; scoped CSS |
| Project Overview | `apps/web/src/components/dashboards/student/StudentProjectOverview.tsx`, `project-overview.css`, `my-project-workspace.css` | Tinted project cover, rows, labels, actions and existing cards |
| Group & Members | `apps/web/src/components/dashboards/student/ProjectGroupPanel.tsx`, `project-group.css` | Group cover, members-first layout, contextual actions, Invite and Settings disclosure |
| Guide and assistant | `apps/web/src/providers/researcher-guide-provider.tsx`, `apps/web/src/components/guide/GuideDrawer.tsx`, `FloatingResearcherAssistant.tsx`, `apps/web/src/providers/workspace-tour-provider.tsx` | Existing Guide + walkthrough anchors + floating AI; never recreate parallel UI |

**Precedence:** Existing semantic theme + shared frame > Researcher shell > page-scoped stylesheet > isolated component rules. Do **not** copy all `.rh-*`, `.po-*`, or `.pg-*` selectors into a global stylesheet. Preserve scoping to prevent cross-role regressions. For another role, reuse the shell and tokens, then build role-specific components.

## 3. Practical visual recipe from main

### Surfaces and color

Use existing semantic variables, not a manually selected fixed palette:

```css
/* Example for a NEW page only — preserve the live tokens instead of redefining them */
.my-researcher-page {
  color: var(--color-text-primary);
}
.my-researcher-page__card {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--workspace-card-radius, 16px);
}
.my-researcher-page__muted { color: var(--color-text-secondary); }
.my-researcher-page__link { color: var(--color-primary); }
.my-researcher-page__action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}
```

Canonical values for the shared frame at this baseline: `--workspace-page-max: 1360px`, `--workspace-page-gutter: clamp(16px, 2vw, 32px)`, `--workspace-card-padding: 24px`, `--workspace-card-radius: 16px`, `--workspace-panel-radius: 12px`. The frame's content canvas uses a **32px asymmetric outer corner** on desktop (24px on mobile); do not add a competing second canvas.

**Important distinction:** `researcher-workspace-surfaces.css` intentionally neutralizes **non-Home** Researcher content surfaces in light mode; the Home preserves a college-themed atmosphere. It also explicitly restores proper local dark surfaces when dark mode is active. Do not remove or bypass this behavior.

The Home alone uses the scoped `--rh-*` palette, including the softened college-gradient hero, golden progress accents, and a restrained card shadow (removed in dark mode). Project Overview and Group use a subtler gradient of `var(--color-surface)` and approximately **8% primary tint**, with a grayscale seal at roughly 7% opacity. Never use the Home's white-on-brand text treatment on ordinary neutral cards.

### Type and hierarchy

- Page title: typically **20–26px**, weight **600**, compact line height; titles may be smaller on mobile.
- Section heading: about **16–18px**, weight **600**.
- Body and list rows: mostly **13–14.5px** with readable line height; keep normal prose concise.
- Meta/status/date labels: roughly **11–13px**; reserve strong color for actionable danger or urgent dates.
- Use the project's existing font stack and semantic text colors; do not introduce new fonts or hardcoded decorative headings.

### Spacing, borders, buttons

- Main screen stack: **18–24px** between logical groups, depending on existing component.
- Typical panel padding **22–24px** (mobile **16–20px**), 1px semantic border, radius **16–18px**. Dense subpanels can use 12px radius.
- Controls: target **44px minimum** where practical; existing Home primary controls use at least 44px and the shared navigation uses 44px rows.
- Use a single prominent primary action for the user's next task; supporting actions become text links, quiet icon buttons, dropdown actions, or disclosures.
- Prefer fine dividers to nested cards and badges. Use meaningful semantic status colors rather than repeated multicolored pills.
- Hover and active states must use theme variables; focus-visible must be clearly outlined. Never rely on hover alone.

### Header/seal pattern

- **Home:** Large branded gradient hero; seal is decorative (`alt=""`, `aria-hidden`, no interaction), positioned to the right and very low-contrast. Research title and content stay above it.
- **Project/Group:** Compact soft-gradient header; same faint grayscale seal logic; clear title and lightweight context.
- **Other pages:** Usually a conventional titled header or restrained tinted surface. Use a branded seal **only if it improves information hierarchy**; avoid a wall of repeated logos.

### Desktop, mobile and reduced motion

- Home dual cards become one column at around **1099px**; Next Step compresses around **899px**; mobile changes around **767px**, including a compact journey bar instead of the full timeline.
- Shared sidebar transitions to mobile behavior around **1023px**; preserve collapsed sidebar interactions, topbar visibility, and scrollable content where needed.
- Respect `prefers-reduced-motion`; do not add gratuitous zooms, flashing animations, or layout jumps.

## 4. Behavior and integration that must survive a styling pass

- **Navigation:** Researcher has Home and grouped Research Workspace, Academic Activities, Schedule and Communication navigation. Preserve active route detection, active project URL context, `aria-current`, and `data-guide`/ `data-tour` targets. Do not invent links or rename routes.
- **Guide:** Visible **Guide** launcher is owned by the shared sidebar (above Settings and Sign Out), not a new page-specific button. The Researcher Guide displays the introductory **Start guided tour** CTA near the top when no help topic/search is selected. Opening Guide must **not** automatically start a tour.
- **AI Assistant:** Keep the existing floating launcher and user-controlled visibility behavior. Never replace it with a fake chat bubble, auto-open it, or trigger proactive API calls on load. It must remain accessible while Guide/tour overlays are managed.
- **Roles and permissions:** Reuse shared styling for Adviser, Panelist, Coordinator/Professor, Dean, System Admin as applicable, but **do not** copy Researcher access, flows, routes, or college context into those roles. Keep capability checks and read-only controls intact.
- **Evaluation isolation:** Do not change the TAM respondent flow, `/evaluate`, seeded evaluation accounts, consent, questionnaire, responses, backend roles or data.
- **Data states:** Support first-login/empty data, populated project, multiple projects, in-progress/released defense result, overdue tasks, permission-limited accounts, and loading/error states. Never fill production UI with fabricated research data just to make it look complete.
- **Accessibility:** Keyboard navigation, Escape/disclosure behavior, `focus-visible`, readable contrast in all college themes, aria labelling, touch targets, and reduced-motion support.

## 5. Known cautions / follow-up polish

1. `dashboard/page.tsx` still has a large `overview-legacy` section and some older hardcoded Tailwind/hex styles outside the newly redesigned main views. **Do not treat those as the new design reference.** Retain behavior during gradual migration.
2. Home's softer colored gradient and Project/Group's subtle cover are **different by design**. Copying the bold Home treatment into every subpage would break the visual rhythm.
3. Researcher/Adviser/Panelist guidance already shares providers. The old `Take a Tour` fallback exists for other unconverted roles; if touching those roles, consult `docs/advisio-guide/ADVISIO_GUIDE_PRODUCT_CONTRACT.md` and role acceptance specs rather than regressing the Guide and AI integration.
4. Theme inheritance is delicate: do not override `--color-background`, `--color-surface`, `--color-primary`, or `--college-*` on a new page root unless the existing Researcher surface rules explicitly require it.
5. This is a **source-level design review**. Browser visual regression across theme/role/viewport combinations and production deployment verification are **still required** before treating future screens as finished.

## 6. Implementation order for remaining Researcher screens

1. **Inspect** current route/component/CSS and its parent layout; establish functionality, permissions, project context, and current `data-guide` anchors.
2. **Reference** the baseline components above; select the appropriate pattern (summary/identity, table/list, schedule, documents, forms, editor, chat). Keep unique functional UI for each page.
3. **Refactor only page-scoped visuals**: spacing, typography, semantic surfaces, alignment, responsive states, and purposeful empty/loading/error presentation.
4. **Preserve the shared shell**: navigation, header, guide, AI assistant, college branding and dark-mode selectors.
5. **Verify** desktop + mobile, light/dark, multiple college palettes, first-login/empty/populated state, primary and secondary actions, accessibility, and guide anchor health.
6. **Commit in a feature branch** and report changed files and tests, without merging/deploying automatically.

Useful commands from repository root (depending on local setup): `npm --workspace=web run type-check`, `npm --workspace=web run test`, `npm --workspace=web run lint`, `npm --workspace=web run build`. Run focused checks first when only one screen changed; do not claim checks passed unless executed.

## 7. Copy/paste handoff prompt for a groupmate / Codex

```text
Work only on the requested ADVISIO screen(s) in heisenberg1122/Advisio_Prototype_Updated.
First read docs/design/RESEARCHER_WORKSPACE_STYLE_BASELINE.md and inspect the exact
main-branch source files it references. The approved visual reference is main
commit 133b501 (Researcher Home, Project Overview, Group & Members).

Goal: bring the specified screen into the approved Researcher design language,
NOT create a new UI concept. Keep college-aware tokens, neutral work surfaces,
restrained tinted headers, 16–18px cards, readable spacing, one clear primary
action, responsive/mobile behavior, and dark mode. Reuse existing shared
shell/components; new CSS must be scoped to the target screen.

Never alter routing, database/API, authentication/permissions, existing research
actions, project context, TAM/evaluation, Guide + Start tour, floating AI Assistant,
or existing data-guide/data-tour anchors. Do not add mock data to real accounts.
Do not replace every page header with the Home hero. Respect reduced motion.

Inspect before editing. Implement only the necessary files. Then verify empty,
populated and error states; desktop/mobile and light/dark theme; and actual
navigation/actions. Run appropriate focused tests and type-check. Report all
changed files, tests actually run, and any remaining limitations. Work on a
feature branch; do not push to main or deploy.
```

### Baseline review links

- [Redesign commit](https://github.com/heisenberg1122/Advisio_Prototype_Updated/commit/47f4338369db903c12c4271800a58e2224359dae)
- [Equal-height Home card refinement](https://github.com/heisenberg1122/Advisio_Prototype_Updated/commit/133b501d875e14ed63477c3e81d143e9e197c678)
- [Common Guide/AI product contract](../advisio-guide/ADVISIO_GUIDE_PRODUCT_CONTRACT.md)
