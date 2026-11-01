import { createClient } from "redis";
import { createHmac, createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";

const WINDOW = 600_000;
const CAPACITY = 5000;
export const securityAuditPrefix =
  process.env.NODE_ENV === "test"
    ? `advisio:{security-audit-test}:${process.pid}:`
    : "advisio:{security-audit}:";
const PREFIX = securityAuditPrefix;
export const securityAuditHealth = {
  mode: "disabled",
  lastFlushAt: null as string | null,
  lastErrorAt: null as string | null,
  overflow: 0,
  pending: 0,
  droppedObservations: 0,
  oldestPendingSeconds: 0,
};
let client: ReturnType<typeof createClient> | undefined;
let connecting: Promise<unknown> | undefined;

async function redis() {
  if (!process.env.AUDIT_REDIS_URL) return null;
  if (
    !process.env.AUDIT_CORRELATION_SECRET ||
    process.env.AUDIT_CORRELATION_SECRET.length < 32
  )
    throw new Error(
      "AUDIT_CORRELATION_SECRET must have at least 32 characters",
    );
  if (!client) {
    client = createClient({
      url: process.env.AUDIT_REDIS_URL,
      socket: { connectTimeout: 1500, reconnectStrategy: false },
      disableOfflineQueue: true,
    });
    client.on("error", () => degraded());
  }
  if (!client.isOpen) {
    connecting ??= client.connect().finally(() => {
      connecting = undefined;
    });
    await connecting;
  }
  return client;
}
function degraded() {
  const now = Date.now();
  // Bounded operational signal; no per-request database fallback or credential output.
  if (
    !securityAuditHealth.lastErrorAt ||
    now - Date.parse(securityAuditHealth.lastErrorAt) > 60_000
  )
    console.error(
      "Security audit store degraded; inspect shared-store health and backlog.",
    );
  securityAuditHealth.lastErrorAt = new Date(now).toISOString();
  securityAuditHealth.mode = "degraded";
}
export function securityReference(value: string) {
  return createHmac(
    "sha256",
    process.env.AUDIT_CORRELATION_SECRET ||
      "development-only-no-persistent-security-audit",
  )
    .update(value.trim().toLowerCase().slice(0, 320))
    .digest("hex");
}

// All keys share a Redis cluster hash tag. Pending hashes have no TTL: acknowledge only after SQL commits.
export const incrementSummaryLua = `
local id=ARGV[1]; local data=KEYS[1]..id
if redis.call('EXISTS',data)==0 and redis.call('ZCARD',KEYS[2])+redis.call('ZCARD',KEYS[3])>=tonumber(ARGV[5]) then
  redis.call('HINCRBY',KEYS[4],ARGV[3],1); return 0
end
if redis.call('EXISTS',data)==0 then
  redis.call('HSET',data,'first',ARGV[2],'kind',ARGV[3],'target',ARGV[6],'source',ARGV[7]);
  redis.call('ZADD',KEYS[2],ARGV[4],id)
end
redis.call('HINCRBY',data,'count',1);
local first=tonumber(redis.call('HGET',data,'first')); local last=tonumber(redis.call('HGET',data,'last') or '0');
if tonumber(ARGV[2])<first then redis.call('HSET',data,'first',ARGV[2]) end
if tonumber(ARGV[2])>last then redis.call('HSET',data,'last',ARGV[2]) end
return 1`;

type SecurityKind =
  | "LOGIN_FAILED"
  | "ACCESS_DENIED"
  | "RECOVERY_REJECTED"
  | "LOGIN_THROTTLED";
let observationsInFlight = 0;
export async function aggregateSecurity(
  kind: SecurityKind,
  target: string,
  source: string,
) {
  if (observationsInFlight >= 256) {
    securityAuditHealth.droppedObservations = Math.min(
      Number.MAX_SAFE_INTEGER,
      securityAuditHealth.droppedObservations + 1,
    );
    degraded();
    return;
  }
  observationsInFlight++;
  try {
    const store = await redis();
    if (!store) {
      securityAuditHealth.mode = "disabled";
      return;
    }
    const now = Date.now(),
      start = Math.floor(now / WINDOW) * WINDOW;
    const targetRef = securityReference(target),
      sourceRef = securityReference(source);
    // Pair plus independent source/target dimensions detect spraying and distributed attempts.
    for (const [dimension, t, s] of [
      ["pair", targetRef, sourceRef],
      ["target", targetRef, ""],
      ["source", "", sourceRef],
    ]) {
      const id = `${kind}:${dimension}:${t}:${s}:${start}`;
      await store.eval(incrementSummaryLua, {
        keys: [
          PREFIX + "data:",
          PREFIX + "active",
          PREFIX + "pending",
          PREFIX + "overflow",
        ],
        arguments: [
          id,
          String(now),
          kind,
          String(start + WINDOW),
          String(CAPACITY),
          t,
          s,
        ],
      });
    }
    securityAuditHealth.mode =
      securityAuditHealth.droppedObservations || securityAuditHealth.overflow
        ? "degraded"
        : "shared";
  } catch {
    degraded();
  } finally {
    observationsInFlight--;
  }
}

export const freezeLua = `
local due=redis.call('ZRANGEBYSCORE',KEYS[1],'-inf',ARGV[1],'LIMIT',0,ARGV[2]);
for _,id in ipairs(due) do
 redis.call('ZREM',KEYS[1],id); redis.call('ZADD',KEYS[2],ARGV[1],id)
end
return due`;

let flushing = false;
export async function flushSecurityAudit() {
  if (flushing) return;
  flushing = true;
  try {
    const store = await redis();
    if (!store) return;
    // Freeze IDs by moving them atomically from active to pending. New windows use different IDs.
    await store.eval(freezeLua, {
      keys: [PREFIX + "active", PREFIX + "pending"],
      arguments: [String(Date.now()), "100"],
    });
    const ids = await store.zRange(PREFIX + "pending", 0, 99);
    const batch = [];
    for (const id of ids) {
      const data = await store.hGetAll(PREFIX + "data:" + id);
      if (!data.count) continue;
      batch.push({
        action: "UPDATE" as const,
        entityType: "SecuritySummary",
        eventType: data.kind,
        contractVersion: 1,
        category: "SECURITY",
        outcome: "FAILURE",
        operationKey: `security:${createHash("sha256").update(id).digest("hex")}`,
        summaryCount: Number(data.count),
        firstOccurredAt: new Date(Number(data.first)),
        lastOccurredAt: new Date(Number(data.last)),
        newValues: {
          count: Number(data.count),
          firstAt: new Date(Number(data.first)).toISOString(),
          lastAt: new Date(Number(data.last)).toISOString(),
          targetReference: data.target,
          sourceReference: data.source,
          dimension: id.split(":")[1],
          windowMilliseconds: WINDOW,
        },
      });
    }
    if (batch.length) {
      await prisma.auditLog.createMany({ data: batch, skipDuplicates: true });
      // Idempotent SQL inserts make competing workers and a crash before acknowledgment safe.
      const acknowledge = store.multi();
      for (const id of ids)
        acknowledge.zRem(PREFIX + "pending", id).del(PREFIX + "data:" + id);
      await acknowledge.exec();
    }
    const overflow = await store.hGetAll(PREFIX + "overflow");
    securityAuditHealth.overflow = Object.values(overflow).reduce(
      (n, value) => n + Number(value),
      0,
    );
    securityAuditHealth.pending = await store.zCard(PREFIX + "pending");
    const oldest = await store.zRangeWithScores(PREFIX + "pending", 0, 0);
    securityAuditHealth.oldestPendingSeconds = oldest[0]
      ? Math.max(0, Math.floor((Date.now() - oldest[0].score) / 1000))
      : 0;
    if (
      securityAuditHealth.overflow ||
      securityAuditHealth.droppedObservations ||
      securityAuditHealth.oldestPendingSeconds > 120
    )
      degraded();
    else securityAuditHealth.mode = "shared";
    securityAuditHealth.lastFlushAt = new Date().toISOString();
    // Overflow stays in one fixed-size hash until an operator acknowledges the incident.
    // It counts lost detailed dimension increments; it is not a count of unique requests.
  } catch {
    degraded();
  } finally {
    flushing = false;
  }
}

// Shared login limiter, independently retained from audit summaries.
export const limitLua = `
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1]);
local isnew=redis.call('ZSCORE',KEYS[1],ARGV[2])==false
if isnew and redis.call('ZCARD',KEYS[1])>=10000 then return {0,900} end
local key=KEYS[2]..ARGV[2]; local n=redis.call('INCR',key)
if n==1 then redis.call('PEXPIRE',key,900000); redis.call('ZADD',KEYS[1],tonumber(ARGV[1])+900000,ARGV[2]) end
local ttl=redis.call('PTTL',key)
if n>tonumber(ARGV[3]) then return {0,math.max(1,math.ceil(ttl/1000)),n==tonumber(ARGV[3])+1 and 1 or 0} end
return {1,0,0}`;
export async function sharedLoginLimit(
  target: string,
  source: string,
): Promise<{ allowed: boolean; retryAfter: number; pairKey: string } | null> {
  const store = await redis();
  if (!store) return null;
  const pairKey = securityReference(`${source}:${target}`);
  for (const [key, limit] of [
    [pairKey, 10],
    ["source:" + securityReference(source), 1000],
    ["target:" + securityReference(target), 100],
  ] as const) {
    if (key.startsWith("target:") && target === "unknown") continue;
    const result = (await store.eval(limitLua, {
      keys: [PREFIX + "limits", PREFIX + "limit:"],
      arguments: [String(Date.now()), key, String(limit)],
    })) as number[];
    if (!result[0]) {
      if (result[2] === 1) {
        const now = Date.now();
        // Immutable episode notification is ready for the next worker pass, without waiting ten minutes.
        await store.eval(incrementSummaryLua, {
          keys: [
            PREFIX + "data:",
            PREFIX + "active",
            PREFIX + "pending",
            PREFIX + "overflow",
          ],
          arguments: [
            `THROTTLE_ACTIVATED:episode:${key}:${now}`,
            String(now),
            "THROTTLE_ACTIVATED",
            "0",
            String(CAPACITY),
            securityReference(target),
            securityReference(source),
          ],
        });
      }
      return { allowed: false, retryAfter: result[1], pairKey };
    }
  }
  return { allowed: true, retryAfter: 0, pairKey };
}
export async function clearSharedLoginLimit(pairKey: string) {
  try {
    const store = await redis();
    await store
      ?.multi()
      .del(PREFIX + "limit:" + pairKey)
      .zRem(PREFIX + "limits", pairKey)
      .exec();
  } catch {
    degraded();
  }
}

export function startSecurityAuditWorker() {
  if (!process.env.AUDIT_REDIS_URL) {
    console.warn(
      "Shared security audit is disabled: configure AUDIT_REDIS_URL and AUDIT_CORRELATION_SECRET.",
    );
    return () => {};
  }
  void flushSecurityAudit();
  const timer = setInterval(() => void flushSecurityAudit(), 30_000);
  timer.unref();
  return () => {
    clearInterval(timer);
    if (client?.isOpen) client.destroy();
  };
}
export function closeSecurityAuditStore() {
  if (client?.isOpen) client.destroy();
  client = undefined;
}
