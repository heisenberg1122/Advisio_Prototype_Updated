# Audit trail implementation plan

Prepared: October 30, 2026 (Asia/Manila).
Status: proposed implementation; application code and infrastructure are unchanged.

## Objective

Provide attributable, searchable histories of important Advisio operations while bounding database writes from repetitive or attacker-controlled traffic. Preserve every critical business event individually. Summarize repetitive security events without making those summaries a prerequisite for immediate detection or rate limiting.

This plan strengthens the existing centralized audit system. Hash chaining remains deferred as described in `blockchain-inspired-ledger-plan.md`.

## Current implementation evidence

- `packages/database/prisma/schema.prisma`: `AuditLog` stores actor relation, action, entity, optional before/after values, IP address, user agent, and creation time. The actor relation uses `onDelete: SetNull`.
- `apps/api/src/middleware/audit.ts`: shared middleware is a placeholder; event creation currently lives in individual routes and services.
- `apps/api/src/routes/admin-overview.routes.ts`: the system-admin overview returns the six latest events for selected administrative entity types.
- `apps/web/src/components/system-admin/SystemAdminOverview.tsx`: the logs tab reuses that six-event feed.
- `apps/api/src/middleware/recovery-rate-limit.ts`: login limiting uses a bounded, per-process Map keyed by IP/email, with a 15-minute window and ten allowed attempts; successful responses clear the entry. Recovery limiting also uses process memory.
- `apps/api/package.json`: no Redis client or durable queue dependency is currently declared. Shared security aggregation requires new infrastructure, configuration, and deployment checks.

## Event policy

| Category | Events | Persistence policy |
| --- | --- | --- |
| Account lifecycle | Registration, approval/rejection, suspension, restoration, archive, deletion | One event per completed change, including reason where required |
| Access administration | Role, permission, college/program scope changes | One event per change with selected before/after fields |
| Research workflow | Participation changes, submissions, transitions, review decisions, reviewer assignment/removal, defense scheduling changes | One event per completed meaningful operation |
| Grades and evaluations | Final submission, publication, correction, clearance | One event per operation; record changed values and correction reason; exclude autosaves |
| Document provenance | Manuscript version submission, signature, official-copy issuance/revocation | One event per operation, identifying exact versions and applicable hashes |
| Sensitive access | Protected manuscript/official-copy download, audit export | One event per authorized application handoff or export; do not claim delivery completion when the server cannot observe it |
| System configuration | Security settings, integrations, institutional configuration | One event per change; allowlist metadata and exclude credentials |
| Successful authentication | Password/Google sign-in, explicit logout, password reset completion, session revocation | One event per actual operation; do not record each authenticated request or token validation |
| Failed authentication | Invalid credentials, rejected recovery attempts | Time-window summaries, including windows containing only one failure |
| Defensive response | Throttle activation, explicit temporary lockout if implemented, security alert activation | One event per activation/episode; aggregate subsequent blocked requests |
| Access denial | Repeated denied operations | Summaries by safe operation category and scope; alert on sensitive patterns |
| Routine traffic | Page views, searches, dashboard refreshes, health checks, draft autosaves | Operational metrics/logs rather than database audit rows |

Maintain a route/service coverage inventory. Preserve existing useful events during migration and document intentional exclusions. Failed critical operations must never be represented as successful changes.

## Event contract and storage

Extend the existing `AuditLog` additively for business events and security summaries. Keep existing readers and writes compatible during migration.

Proposed additions:

- Versioned `eventType` and `category` separate from the existing broad action enum; validate allowed combinations centrally.
- `outcome`, severity, server-observed occurrence time, and a request/operation identifier.
- Stable actor reference and validated role at the time of the action. Store minimal display context only where justified by the institution's privacy/retention policy.
- Optional research-project scope, exact document/evaluation version reference, and bounded reason code/text.
- Allowlisted before/after changes; never serialize entire Prisma objects or request bodies.
- For security summaries: aggregation ID, window start/end, first/last occurrence, count, and breakdown of allowed outcome/reason codes.
- Optional unique operation key for retryable operations; distinguish event types within the same operation so valid companion events are not suppressed.

Use UTC in storage and Philippine Time in the viewer. Bound field lengths, changeset size, summary detail, and user-agent length. Exclude passwords, cookies, tokens, reset links, connection strings, signing secrets, and manuscript contents. Treat IP addresses and account references as restricted data. Use a keyed digest of a normalized attempted identifier for correlation when authentication fails; do not treat that digest as anonymous data.

Failed attempts have an unauthenticated actor. An attempted account reference identifies a target, not the person making the attempt. Preserve generic public authentication responses so logging does not disclose account existence.

## Reliable business-event recording

Introduce a typed `audit.service.ts` accepting the caller's Prisma transaction, validated actor context, and an allowlisted event payload. Use lightweight request middleware only to establish request IDs and safe context; generic HTTP middleware cannot determine academic business outcomes.

For critical database operations, commit the change and audit insert in one transaction. Audit failure rolls back the critical change and returns a retryable error. Do not create success events from response-finish hooks. For external storage/email operations, document the actual boundary and use existing outbox patterns or an explicit operation state; a SQL transaction cannot roll back an external effect.

Assign one owner to each event to avoid duplicate route/service records. Retry deduplication keys must be generated or validated by the server and scoped to the actor and operation, rather than trusting arbitrary client identifiers.

## Bounded security aggregation

Use a shared Redis-backed counter/aggregation adapter in deployed environments. Keep authentication protection counters distinct from audit summaries so flushing a summary cannot reset a rate limit. In-memory adapters are suitable for tests or explicitly single-instance development only.

1. Count failures immediately without inserting a PostgreSQL row per request. Use atomic operations across API instances.
2. Start with ten-minute audit windows as a configurable proposal; preserve current login protection thresholds until a separate tested policy change is justified.
3. Aggregate by a controlled combination of event type, account digest, source reference, and window. Include cross-account source totals and cross-source target totals to detect spraying and distributed attacks.
4. Bound key cardinality, detail samples, per-source entries, total entries, worker concurrency, batch size, and flush throughput. When detailed capacity is exhausted, increment fixed overflow buckets instead of creating unlimited keys or dropping all evidence.
5. Emit one threshold/activation event promptly per episode. Subsequent attempts update counters rather than creating repeated alerts. Deduplicate alert delivery.
6. Flush closed windows, including single-failure windows, through a durable pending/claim/ack process. Use a deterministic unique summary ID so retries do not duplicate counts. Close windows atomically and route late arrivals to a new bounded bucket.
7. Retain pending data until PostgreSQL acknowledges persistence. Counter TTL must outlast the window plus retry allowance; TTL alone is not a flush mechanism. Configure Redis persistence and recovery and document the remaining loss window.
8. Use bounded retries with backoff, queue-age alarms, overflow metrics, and a tested outage policy. Redis failure must not disable rate limiting: use a bounded local emergency limiter or temporarily reject affected authentication requests. Do not fall back to one PostgreSQL audit insert per failed request during an attack.
9. If PostgreSQL is unavailable, retain pending summaries within configured capacity and signal degradation through independent operational monitoring. Record overflow/loss counts where possible; never claim complete evidence after capacity or persistence loss.

Example acceptance case: twelve matching failures within a window produce one final summary with count twelve, plus at most one activation event for each configured defensive episode. A distinct successful login remains an individual event. Twelve distinct identifiers must not bypass global capacity limits.

## Database protections and lifecycle

- Use a non-owner runtime database role with INSERT and scoped SELECT access to audit storage, without ordinary UPDATE/DELETE/TRUNCATE privileges. Keep migrations and retention operations under separate privileged identities. Verify deployed role membership and ownership rather than assuming Prisma startup credentials are restricted.
- Add audit-specific rejection triggers as defense in depth. Corrections append a new event referencing the original; ordinary administrators have no edit/delete endpoint.
- Resolve the current `onDelete: SetNull` actor relation before enforcing unconditional update rejection. Prefer storing the actor identifier as a stable historical reference without a cascading/mutating foreign key, with an optional lookup for current display. Account deletion must succeed without rewriting or deleting prior events.
- Identify any other mutable foreign keys before adding project/version references. Historical scope and provenance must survive record deletion.
- Preserve existing records without fabricating missing roles, outcomes, or actor names. Mark their contract version as legacy/unknown as appropriate.
- Add only indexes justified by actual filters: `(createdAt, id)` for cursor order, plus scoped time indexes for actor, project, and category where query plans justify them. Use a partial unique index for non-null idempotency keys. Avoid blanket JSON indexing.
- Define retention separately for academic history, security events, and sensitive network metadata. Institution-approved durations are a release prerequisite for automated deletion; do not invent a compliance period or retain everything indefinitely.
- Archive through a separately authorized maintenance process with verified exports and recovery checks before deletion. Do not introduce automatic purge in the first release. Evaluate partitioning after measuring volume; plan index/uniqueness constraints before adopting it.

Database owners can bypass these controls. Describe them as application append-only protections, not absolute immutability. Protected copies outside the operational database improve recovery and evidence preservation.

## Read API and viewer

Add dedicated paginated list and detail endpoints, independent of `/api/admin/overview`. Keep the six-event dashboard preview lightweight.

- Require authentication and server-enforced authorization for lists, details, filters, counts, and exports.
- System administrators receive administrative/security views. Academic history access follows existing project and role permissions; access to a project must not expose unrelated security logs, credentials, or raw network metadata.
- Use stable descending `(createdAt, id)` cursors, a proposed default page size of 25 and maximum of 100, bounded date ranges, and validated filter values. Avoid an exact total count on every request.
- Support date, category, event type/action, actor, outcome, and project/entity filters. Begin with indexed identifiers and bounded actor lookup instead of arbitrary JSON substring search.
- Show readable event descriptions, Philippine Time, role at the time, before/after fields, reasons, exact versions, and expandable security summary counts/windows. Label unknown legacy values and degraded security coverage honestly.
- Make summary count and first/last timestamps visible; a row may represent multiple attempts.
- Add capped/streamed exports with the same permissions, rate limits, CSV formula-injection protection, and an audit event for the export operation. Avoid logging every page view of the viewer.
- Add project timelines after the administrative viewer is validated; return only approved academic fields.

## Implementation sequence

| Phase | Deliverables | Completion gate |
| --- | --- | --- |
| 1. Inventory and contract | Route/service coverage matrix, event catalog, payload allowlists, role visibility rules, baseline volume measurements | Each critical operation has an event owner and documented transaction boundary |
| 2. Storage and writer | Additive migration, typed writer, safe actor context, operation deduplication, append-only role/trigger design | Rollback, deletion compatibility, privileges, and retry behavior pass database integration tests |
| 3. Business coverage | Migrate existing writes incrementally; fill account, academic decision, grade, signature, and configuration gaps | One attributable event per actual critical change; no duplicate events or sensitive payload leakage |
| 4. Security pipeline | Redis provisioning/client, shared counters, durable flush worker, capacity controls, outage metrics and runbook | Multiple API instances, retries, restarts, high-cardinality attacks, and dependency outages tested |
| 5. Admin viewer | Scoped list/detail API, filters, cursor pagination, event descriptions, capped export | Authorization, ordering, privacy, and query-cost checks pass |
| 6. Project histories and operations | Project timeline, retention policy, protected archival procedure, dashboards and alerts | Cross-project isolation and operational recovery validated |

Deploy additive schema changes before new writers/readers. Switch event families in small batches, using one active writer per operation. Do not run duplicate production writes simply to compare implementations. Enable security aggregation only after the shared store, worker, and outage monitoring are ready.

## Validation and performance gates

- Unit tests: event allowlists/redaction, size limits, role-at-event validation, summaries, threshold deduplication, single-event windows, late arrivals, and bounded overflow behavior.
- Database integration tests: business change/audit atomicity, unique retries, legacy compatibility, account deletion, correction events, and runtime INSERT/SELECT versus denied UPDATE/DELETE/TRUNCATE using the actual restricted role.
- API/UI tests: unauthorized list/detail/export, cross-project leakage, restricted security fields, filter validation, equal-timestamp pagination, event detail rendering, and export limits.
- Shared-store tests: concurrent increments, competing workers, failure before/after persistence acknowledgment, restart recovery, unavailable Redis/PostgreSQL, and capacity exhaustion. Count all twelve illustrative failures exactly once after retry recovery.
- Load tests: representative academic traffic plus repeated and high-cardinality failed-login bursts; record audit rows per minute, query latency, database CPU/connections, authentication latency, Redis memory, backlog age, and aggregation loss/overflow counters.
- Set numeric latency, memory, backlog, and storage budgets from the baseline in phase 1. Release only after measuring against those budgets; do not claim database-load improvements without results.
- Run relevant workspace tests, database integration tests, lint, type checks, and builds. Preserve existing access controls and tests.
- After every eventual push, inspect GitHub Actions and deployment results for that exact commit. Report local validation, remote CI, deployment, and runtime migration/provisioning checks separately. Investigate failing checks; explicitly report checks still running.

## Rollout and recovery

Use category-level feature flags for new viewers and security aggregation, while keeping established critical audit recording active. A rollback may hide new UI or stop a new aggregation producer after safely draining its pending windows; it must not erase audit history or silently disable existing protections. Once restricted database roles are enabled, runtime deployment must not depend on migration-owner credentials.

Document the worker owner/scheduler, startup readiness checks, alert recipients, independent monitoring destination, archive custody, and response to a full queue or unavailable store before production enablement. Alerting integrations require their own configured destination; this planning task sends no notifications.

## Deferred scope

- Hash-linked ledgers, distributed consensus, and blockchain claims.
- Logging full HTTP requests, manuscript text, or every user navigation.
- Automatic permanent account suspension based only on failed passwords.
- Broad changes to authentication thresholds without separate justification and tests.
- Automatic historical data purges before a retention policy and verified archival procedure exist.

## Reference

OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

The security summaries deliberately trade per-attempt database detail for bounded storage; they must be described as summaries rather than a complete forensic record of every request.
