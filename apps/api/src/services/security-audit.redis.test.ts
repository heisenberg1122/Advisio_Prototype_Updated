import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { createClient } from "redis";
const db = vi.hoisted(() => ({ auditLog: { createMany: vi.fn() } }));
vi.mock("../lib/prisma.js", () => ({ prisma: db }));
import {
  incrementSummaryLua,
  freezeLua,
  limitLua,
  aggregateSecurity,
  flushSecurityAudit,
  securityAuditPrefix,
  closeSecurityAuditStore,
} from "./security-audit.service.js";

const redisDescribe = process.env.AUDIT_TEST_REDIS_URL
  ? describe
  : describe.skip;
redisDescribe("shared Redis audit aggregation", () => {
  const prefix = securityAuditPrefix;
  let store: ReturnType<typeof createClient>;
  beforeAll(async () => {
    const url = new URL(process.env.AUDIT_TEST_REDIS_URL!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      process.env.NODE_ENV !== "test"
    )
      throw new Error("Redis tests require an isolated local Redis instance");
    vi.stubEnv("AUDIT_REDIS_URL", url.href);
    vi.stubEnv(
      "AUDIT_CORRELATION_SECRET",
      "audit-test-correlation-secret-at-least-32-chars",
    );
    store = createClient({ url: url.href });
    await store.connect();
  });
  beforeEach(async () => {
    const keys = await store.keys(prefix + "*");
    if (keys.length) await store.del(keys);
    db.auditLog.createMany.mockReset().mockResolvedValue({ count: 1 });
  });
  afterAll(async () => {
    const keys = await store.keys(prefix + "*");
    if (keys.length) await store.del(keys);
    closeSecurityAuditStore();
    await store.quit();
    vi.unstubAllEnvs();
  });
  const increment = (id: string, capacity = 10, due = 0) =>
    store.eval(incrementSummaryLua, {
      keys: [
        prefix + "data:",
        prefix + "active",
        prefix + "pending",
        prefix + "overflow",
      ],
      arguments: [
        id,
        "100",
        "LOGIN_FAILED",
        String(due),
        String(capacity),
        "target",
        "source",
      ],
    });
  it("counts twelve concurrent failures exactly and freezes only closed windows", async () => {
    await Promise.all(Array.from({ length: 12 }, () => increment("same")));
    expect(await store.hGet(prefix + "data:same", "count")).toBe("12");
    await increment("future", 10, 9999);
    await store.eval(freezeLua, {
      keys: [prefix + "active", prefix + "pending"],
      arguments: ["100", "100"],
    });
    expect(await store.zRange(prefix + "pending", 0, -1)).toEqual(["same"]);
    expect(await store.zRange(prefix + "active", 0, -1)).toEqual(["future"]);
  });
  it("bounds high-cardinality detailed buckets and retains overflow evidence", async () => {
    await Promise.all(
      Array.from({ length: 100 }, (_, i) => increment(`target-${i}`, 5)),
    );
    expect(await store.zCard(prefix + "active")).toBe(5);
    expect(await store.hGet(prefix + "overflow", "LOGIN_FAILED")).toBe("95");
  });
  it("retains single failures on SQL outage and retries with the same operation key", async () => {
    await increment("LOGIN_FAILED:pair:example");
    db.auditLog.createMany.mockRejectedValueOnce(new Error("SQL unavailable"));
    await flushSecurityAudit();
    expect(await store.zCard(prefix + "pending")).toBe(1);
    const first = db.auditLog.createMany.mock.calls[0][0];
    await flushSecurityAudit();
    expect(db.auditLog.createMany.mock.calls[1][0]).toEqual(first);
    expect(first.skipDuplicates).toBe(true);
    expect(first.data[0].newValues.count).toBe(1);
    expect(await store.zCard(prefix + "pending")).toBe(0);
  });
  it("uses independent pair, target and source counters without passwords or raw identifiers", async () => {
    await aggregateSecurity("LOGIN_FAILED", "student@example.edu", "192.0.2.5");
    const ids = await store.zRange(prefix + "active", 0, -1);
    expect(ids).toHaveLength(3);
    expect(ids.join()).not.toContain("student@example.edu");
    expect(ids.join()).not.toContain("192.0.2.5");
  });
  it("enforces the existing ten-attempt pair threshold atomically", async () => {
    const results = await Promise.all(
      Array.from(
        { length: 12 },
        () =>
          store.eval(limitLua, {
            keys: [prefix + "limits", prefix + "limit:"],
            arguments: [String(Date.now()), "pair", "10"],
          }) as Promise<number[]>,
      ),
    );
    expect(results.filter((result) => result[0] === 1)).toHaveLength(10);
    expect(results.filter((result) => result[0] === 0)).toHaveLength(2);
  });
});
