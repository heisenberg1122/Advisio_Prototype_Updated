# Audit trail: implementation and operations

Implemented November 1, 2026. This is an application audit system, not a blockchain or a guarantee against a database owner rewriting history.

## Delivered behavior

- The existing Prisma audit writers are enriched by a query-only extension: event contract version, category, event type, immutable actor reference, validated request role context, server-generated request ID and bounded client metadata. Nested credential fields are removed before insertion. Payloads larger than 16 KiB are rejected so callers must supply minimal metadata.
- Existing rows remain legacy version 0 with UNKNOWN outcomes; the migration preserves known actor IDs without inventing historical roles. User deletion no longer cascades into or rewrites audit history. Owners retain maintenance access; non-owners are blocked by audit UPDATE/DELETE/TRUNCATE triggers even if accidentally granted those privileges.
- Dedicated admin list/detail/CSV endpoints replace the six-event logs tab. The dashboard preview stays small and now includes USER_ACCOUNT status events. Lists use stable time/UUID cursors, 25-row defaults, a 100-row maximum and a 366-day maximum date range. Exports cap at 1,000 rows and one export per administrator per minute per API instance, and record the export handoff.
- Password and Google login success, account registration, password reset completion, explicit logout requests, final live evaluation submission, released defense results, and title-proposal revision decisions now have audit writes in addition to previous coverage. Business changes added here use their transaction for the associated audit event. Logout keeps the previous client-session behavior: it records the request, clears the client credential and cookie, and does not claim revocation of every bearer token. Local credentials are cleared even if server acknowledgment fails. Password reset continues to revoke all sessions.
- Project history is available to active student/adviser group members through `/api/research/:researchId/audit`, and from the student project overview. It returns an allowlisted event envelope, never grades, review text, security events, IP addresses, or before/after payloads. Only explicitly project-scoped records appear; legacy history is not reconstructed.

## Security aggregation and load limits

Set `AUDIT_REDIS_URL` to a dedicated Redis connection and `AUDIT_CORRELATION_SECRET` to a separately managed random secret of at least 32 characters. Use TLS and Redis ACLs in deployed environments. Never put either value in the repository. Every API instance must use the same store and correlation secret. The Redis client dependency is installed; provisioning the service and setting hosted secrets are separate deployment operations.

With these settings present, middleware records failed login, login throttling, rejected recovery operations and access-denial observations in atomic Redis counters. Successful authentication is recorded individually in PostgreSQL. Generic public recovery responses do not reveal whether an account exists and do not create fake successful-account events.

Details:

- Ten-minute summary windows, with first/last occurrence and count. Even a single failure is flushed.
- Pair, source, and target dimensions overlap: twelve matching failures produce one pair summary plus source and target summaries. Their counts must not be added as unique requests. HMAC references replace raw attempted email/IP identifiers in security summaries.
- At most 5,000 detailed active/pending buckets across instances. Excess detail increments one fixed overflow hash by event type. Overflow is retained for operator review and represents lost dimension detail, not unique attempts.
- At most 256 observation operations in flight per process. Excess observations increment a bounded local loss metric and mark coverage degraded. Process failure can lose that local metric; this is not presented as lossless evidence.
- Every 30 seconds, one pass moves at most 100 closed buckets to pending and inserts at most 100 summaries in one SQL batch. SQL operation keys deduplicate competing workers or retries after an insert/acknowledgment failure. Pending evidence has no TTL and is acknowledged only after SQL commits.
- Each API process runs a worker; an in-process guard prevents overlapping passes. Shared-store operations and idempotent SQL inserts tolerate more than one process. Retry occurs on the next 30-second pass. The oldest pending age and overflow are exposed to authorized administrators; failures emit rate-bounded operational warnings.
- Login protection is independent of audit windows. The original ten-attempt pair limit over fifteen minutes remains. With Redis, additional ceilings of 1,000 source attempts and 100 target attempts per fifteen minutes (unknown Google targets are excluded from the target ceiling) and 10,000 limiter-key capacity bound spraying and memory growth. Successful responses clear only the pair limiter. Throttle activation is queued once when a limiter crosses its threshold and is eligible for the next worker pass; repeated blocked requests go into summaries.
- When configured Redis is unavailable, sign-in fails with a temporary 503 instead of silently removing protection or inserting a PostgreSQL record for every failed attempt. Without Redis configuration, the pre-existing per-process limiter remains and the admin viewer reports security aggregation not configured. Recovery protection retains its existing local limiter; it is not claimed to be distributed.

Configure Redis persistence, backups, access restrictions, and `maxmemory-policy noeviction` with a memory allocation established by load testing. Redis restart/failover loss depends on its persistence configuration. Closed summaries are durable only to that configured boundary. Backlog is bounded; sufficiently long outages cause explicit loss of detail. Current workers do not automatically reset overflow evidence.

## Database deployment

1. Back up and verify recovery before deploying migration `20261101090000_audit_trails`. It removes the mutable user FK, adds metadata/indexes, backfills only known actor references, and installs protections. It performs an actor-ID backfill; schedule it against measured table size.
2. Maintain separate migration-owner and runtime identities. Keep the migration owner in `DIRECT_URL`; set `DATABASE_URL` to the runtime login. The startup migration command uses Prisma's direct URL. Never give the runtime role owner membership or superuser/BYPASSRLS capabilities.
3. As the migration owner, apply `packages/database/scripts/audit-runtime-role.sql` with the separately provisioned runtime role. It grants normal application table access and removes audit mutation privileges. Reapply after migrations that create tables. Managed database role creation/password setup must use the provider's secure administration flow.
4. Enable `AUDIT_ENFORCE_RUNTIME_ROLE=1` after the runtime identity is configured. Startup checks refuse an audit owner or an identity with audit UPDATE/DELETE/TRUNCATE privileges. Without this flag, startup warns; append-only protection must not be claimed when the API still runs as owner.
5. Configure Redis and its secret, restart all API instances, verify successful sign-in and repeated-failure summaries, and observe backlog for at least two windows. Validate a protected export and the current deployment commit separately from CI.

The isolated integration tests use an owner only for fixture creation/cleanup and explicitly SET ROLE to a temporary non-owner to test INSERT/SELECT and rejected UPDATE/DELETE/TRUNCATE. No production cleanup path bypasses restrictions for the runtime identity.

## Coverage and remaining rollout gates

| Event family                                                                      | Owner / transaction boundary                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing account status, role/scope changes and deletion                          | Existing account/user services and route transactions; shared writer enrichment applies                                                                                                           |
| New password/Google success                                                       | Auth route transaction with last-login change                                                                                                                                                     |
| New registration                                                                  | Auth route transaction with account creation                                                                                                                                                      |
| New reset completion                                                              | Recovery service transaction with conditional token consume and session-version increment                                                                                                         |
| Explicit logout                                                                   | Authenticated logout endpoint; records requested client sign-out, not universal JWT revocation                                                                                                    |
| Existing document uploads, submissions, decisions, signatures and official copies | Existing document/reviewer/signature/archive services; shared writer enrichment applies                                                                                                           |
| New final live evaluation / result release                                        | Live-defense transaction; draft autosaves excluded                                                                                                                                                |
| New title-proposal revision request                                               | Existing title-proposal review transaction                                                                                                                                                        |
| Workflow and organization events                                                  | Existing route/service event owners; published phase/milestone/requirement edits now insert their event in the business transaction, while notification delivery remains best effort after commit |
| Security failures                                                                 | Redis counters and pending summaries; no SQL event per individual request                                                                                                                         |
| Export                                                                            | Admin API records authorized handoff before returning CSV; no claim that the browser saved it                                                                                                     |

This release is not completion of every institutional rollout gate in the architecture plan. Production Redis provisioning, runtime-role activation, alert routing, measured load/storage budgets and institution-approved retention remain operational prerequisites. No load-reduction percentage or regulatory retention period is claimed. Legacy audit JSON is filtered on read, not rewritten in place. Sensitive downloads retain their existing route behavior; some workflow-resource previews are labeled DOWNLOAD.

Retain academic events individually. Do not log routine page views, searches, health checks, draft autosaves or full requests. Do not automatically purge old audit history. Establish different approved retention periods for academic, account/security and network metadata, then implement a separate owner-authorized verified archive process. Hash-linked approval ledgers remain outside this change.

## Checks and incident response

Run API/web unit tests, type checks, lint and builds. Run the sequential database integration script only against its explicitly verified disposable `advisio_test` database; `AUDIT_TEST_REDIS_URL` must point to an isolated local Redis instance. CI supplies PostgreSQL and Redis services for these suites.

Monitor the admin API's security status plus independent operational logs for degraded mode, overflow, dropped observations, worker inactivity and oldest pending age above 120 seconds. These health values are process-local observations of a shared backlog, not a durable monitoring history. Configure an external monitor and approved notification destination before relying on alerts. Stop a bad producer while leaving established business audit recording active; preserve pending Redis keys for recovery. Do not clear overflow or pending buckets simply to silence an alarm.

After any push, inspect Actions and deployment results for the exact commit and report them separately from local tests. A successful push alone establishes neither passing CI nor a successful deployment.
