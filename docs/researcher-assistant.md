> **TAM branch:** The AI Assistant has been removed from this branch. This document describes the implementation retained on `main`. TAM keeps the updated written Guide and walkthroughs; see [TAM Guide-only scope](tam-guide-only.md).

# Researcher Assistant implementation

The Researcher workspace now has a floating **Ask Advisio** button and a conversational panel connected to Guide. The panel opens on request, follows the existing college/display theme, and minimizes when a Guide or walkthrough opens. The existing Guide remains available through the sidebar.

## Architecture

- Verified Guide articles and search live in `packages/shared/src/researcher-help.ts`. The frontend re-exports them through its existing module. A dedicated project-details article and walkthrough were added.
- `packages/shared/src/researcher-assistant.ts` adds English/Taglish matching, confidence handling, permission-filtered help, and trusted action identifiers. It covers class access, joining a group, members, project details, requirements, documents, upload/version history, submissions, milestones, grades, defense, adviser contact, theme, messages and settings.
- `FloatingResearcherAssistant.tsx` and `researcher-assistant.css` provide the panel, suggestions, loading/errors/retry, keyboard access and responsive layout. `researcher-guide-provider.tsx` authorizes each Take me there, Show me and Open Guide action and preserves the selected project.
- `POST /api/researcher-assistant` uses existing authentication and the Researcher role. It resolves confident questions from verified help, clarifies ambiguity and uses the server-side provider for remaining questions only after the user enables AI explanations.
- AI requests contain the current help-page identifier, the question, up to four relevant recent turns and three to five authorized help entries. Project records, manuscripts, grades, messages and account details are excluded. Duplicate questions and fallback notices are removed from model history.
- The OpenAI Responses adapter requests strict JSON with topic IDs from the retrieved entries and `store: false`. Server validation rejects invented routes, unregistered topics, malformed/incomplete responses and provider failures. The implementation follows the official [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

The conversation remains in component memory, bounded to about 40 displayed messages. Refresh, sign-out, account/college change or Clear conversation removes it. Provider processing follows its data policy. AI explanations are opt-in for each workspace session.

## Appearance preference

**Settings → Appearance → Workspace Assistance → Show floating AI Assistant** defaults ON when no preference exists. OFF hides it immediately. The account-scoped browser key is `advisio:assistant-visible:v1:<userId>`. Explicit OFF survives refresh and signing back into that account in the same browser.

The current account schema supports specific display preferences and browser-local notification preferences. Assistant visibility therefore uses browser-local persistence with an on-screen cross-device explanation. The setting applies separately on other browsers/devices.

## Provider and cost controls

The local preview uses verified help and a provider-unavailable fallback. The AI path was tested using mocked responses.

| Server setting | Default or purpose |
| --- | --- |
| `ASSISTANT_AI_ENABLED` | `false`; explicitly enable provider explanations |
| `OPENAI_API_KEY` | Server-only provider credential |
| `ASSISTANT_MODEL` | Required approved ordinary model supporting Responses structured JSON |
| `ASSISTANT_COMPLEX_MODEL` | Optional stronger model for complex questions |
| `ASSISTANT_TIMEOUT_MS` | 15000, capped at 25000 |
| `ASSISTANT_INPUT_TOKEN_BUDGET` | 10000 conservative UTF-8-byte bound including instruction/envelope allowance |
| `ASSISTANT_OUTPUT_TOKENS` | 650 |
| `ASSISTANT_COMPLEX_OUTPUT_TOKENS` | 1200 |
| `ASSISTANT_REQUESTS_PER_MINUTE` | 15 per account/college per process |
| `ASSISTANT_MAX_CONCURRENT` | 3 per process, with one AI call per account/college |
| `ASSISTANT_DAILY_USER_TOKENS` | 100000 conservatively reserved tokens |
| `ASSISTANT_DAILY_GLOBAL_TOKENS` | 2000000 conservatively reserved tokens |
| `ASSISTANT_REDIS_URL` | Required for production AI; atomic shared daily reservations |
| `ASSISTANT_INPUT_USD_PER_MILLION`, `ASSISTANT_OUTPUT_USD_PER_MILLION` | Optional ordinary-model pricing for estimates |

Budgets reserve a conservative upper bound before a provider call, including its configured maximum output. Reservations are retained after failure/cancellation. Shared Redis daily limits survive process restarts and cover multiple instances. Missing/unavailable production budget storage uses the Guide fallback. Development uses bounded in-memory limits.

There is one model call per eligible request, with cancellation and timeout handling. The server performs no automatic model retry, summarization call, embedding search or model reranking. Only immutable verified answers are cached, keyed by help version, Researcher role, locale and intent. AI output and personal conversation history are excluded from the shared cache.

System Administrators can read `GET /api/researcher-assistant/metrics`. It returns aggregate request, local/cache, AI, fallback, error, latency and provider-token counters without prompts, identity data or credentials. Estimated cost is unavailable when pricing is missing or a separately routed model is unpriced. Metrics cover the process lifetime. The daily quota store has its own persistence.

## Verification

- **584 frontend tests passed across 70 files.** This includes the existing Guide regressions, English/Taglish matching, trusted actions and per-account visibility.
- **25 targeted backend tests passed.** They cover role enforcement, schema/size bounds, rate limits, atomic reservations, production shared-store requirements, consent, grounding, invented-route rejection, timeouts, failures, stronger-model routing, token accounting and cache isolation.
- **63 browser scenarios passed**, comprising 22 assistant scenarios and 41 existing Guide/dashboard-tour regressions. Checks covered zero page-load help requests, all four suggestions, real Group & Members navigation, project-specific help, actual theme-control highlights, Guide handoff, OFF/ON after reload, account isolation, provider fallback, retry, keyboard controls, desktop/tablet/mobile and light/dark mode.
- Web/API type checks, ESLint and both builds passed. Vite retains the existing large-chunk advisory.
- A production-format ESM build was loaded directly and answered a local question with database/provider access disabled. The API build explicitly bundles the shared assistant knowledge module so Node does not need to resolve an uncompiled workspace TypeScript import.

In the local browser run, the ordinary sample API received **15 requests, resolved all 15 without AI, and reported zero provider tokens**. Two of those replies offered the unavailable-provider fallback. The four suggested questions each used the verified-answer layer.

The isolated mocked-provider path received two requests. Its consent step used zero model calls, and the enabled retry used one mocked call reporting **124 input and 54 output tokens**. These are simulation counters. Live provider billing and model quality were not measured.

Evidence is saved in [assistant browser results](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-assistant/browser-results.json>) and [local usage counters](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-assistant/usage-metrics.json>).

Screenshots show the [desktop panel](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-assistant/desktop-light.png>), [narrow dark panel](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-assistant/panel-320.png>), [Appearance setting](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-assistant/appearance-setting.png>) and [Guide handoff](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-assistant/guide-handoff.png>).

## Files

New shared files are `packages/shared/src/researcher-help.ts` and `researcher-assistant.ts`.

New API files are `routes/researcher-assistant.routes.ts`, its test, `services/researcher-assistant.service.ts`, its test, and `services/researcher-assistant-limits.ts`. `apps/api/src/app.ts` registers the separate assistant endpoint.

`apps/api/package.json` adds the shared knowledge alias to the existing API build command. This bundles the runtime help code into the server output.

New web files are `components/guide/FloatingResearcherAssistant.tsx`, `researcher-assistant.css`, `lib/assistant-preference.ts` and `lib/researcher-assistant.test.ts`. Integration edits are in `AccountSettingsPage.tsx`, `researcher-guide-provider.tsx`, `GuideDrawer.tsx`, `researcher-guide.ts` and `researcher-walkthroughs.ts`.

The work is local on `codex/researcher-workspace-ux-redesign`. A snapshot of the prior local changes is in ignored `node_modules/researcher-assistant-baseline`.

## Remaining environment limits

Live provider availability, response quality, latency and billing require the approved server credential/model configuration. Production AI also requires its dedicated shared quota store. Real external provider calls and shared Redis operation were outside the local verification environment.

The route tests use an isolated authentication harness and the existing role middleware. Database-backed authentication and academic operations remain covered by their established implementations. This phase exercised assistant behavior with local sample records and mocked providers.

Group request persistence remains limited by the existing preview API. The Guide explains its actual approval dependency and request-result message. Academic actions remain independent user decisions.
