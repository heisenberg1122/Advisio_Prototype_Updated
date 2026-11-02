import { describe, it, expect } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import { evaluationConfig, isLive, schemaName } from "./config.js";
import { scopedClient } from "./context.js";
import { EVALUATION_COURSES, EVALUATION_ROLES, ROLE_TASKS } from "./catalog.js";

const url =
  "postgresql://test:test@127.0.0.1:5436/advisio_evaluation?schema=public&application_name=advisio-evaluation";
const env = {
  EVALUATION_DATABASE_URL: url,
  DATABASE_URL: url,
  DIRECT_URL: url,
  STORAGE_PROVIDER: "LOCAL",
  EMAIL_PROVIDER: "disabled",
  NOTIFICATION_EMAILS_ENABLED: "false",
  JWT_SECRET: "a".repeat(48),
  EVALUATION_WEB_URL: "http://localhost:3100",
};
describe("evaluation deployment boundaries", () => {
  it("accepts only a dedicated target and safe local or HTTPS entry origin", () => {
    expect(evaluationConfig(env).secure).toBe(false);
    expect(
      evaluationConfig({
        ...env,
        EVALUATION_WEB_URL: "https://evaluation.example.org",
      }).secure,
    ).toBe(true);
    for (const changes of [
      { DATABASE_URL: url.replace("advisio_evaluation", "production") },
      {
        EVALUATION_DATABASE_URL: url.replace(
          "advisio_evaluation",
          "production",
        ),
      },
      { GOOGLE_CLIENT_SECRET: "configured" },
      { STORAGE_PROVIDER: "GOOGLE_DRIVE" },
      { EMAIL_PROVIDER: "resend" },
      { ADVISIO_LOCAL_DEMO: "1" },
      { EVALUATION_WEB_URL: "http://192.168.1.2:3100" },
      { EVALUATION_WEB_URL: "https://user:password@example.org" },
      { EVALUATION_WEB_URL: "https://example.org/evaluate" },
      { EVALUATION_MAX_ACTIVE: "1000" },
    ])
      expect(() => evaluationConfig({ ...env, ...changes })).toThrow();
  });
  it("never accepts arbitrary schema identifiers", () => {
    expect(schemaName("a".repeat(32))).toBe(`eval_${"a".repeat(32)}`);
    for (const value of [
      "public",
      "../outside",
      'x"; DROP SCHEMA public;--',
      "A".repeat(32),
      "a".repeat(31),
    ])
      expect(() => schemaName(value)).toThrow();
  });
  it("requires active state, idle and absolute lifetime simultaneously", () => {
    const session = {
      created_at: new Date(0),
      touched_at: new Date(800),
      state: "ACTIVE",
    };
    expect(isLive(session, 900, 500, 1000)).toBe(true);
    expect(isLive(session, 1000, 500, 1000)).toBe(false);
    expect(
      isLive({ ...session, touched_at: new Date(0) }, 900, 500, 1000),
    ).toBe(false);
    expect(isLive({ ...session, state: "ENDED" }, 900, 500, 1000)).toBe(false);
  });
});
describe("native portal request isolation", () => {
  it("keeps concurrent asynchronous operations on their own database clients", async () => {
    const context = new AsyncLocalStorage<{
      prisma: { identity: () => string };
    }>();
    const proxy = scopedClient(
      { identity: () => "production" },
      context,
      () => true,
    );
    const results = await Promise.all(
      ["student-a", "student-b", "dean"].map((name) =>
        context.run({ prisma: { identity: () => name } }, async () => {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 10),
          );
          return proxy.identity();
        }),
      ),
    );
    expect(results).toEqual(["student-a", "student-b", "dean"]);
    expect(() => proxy.identity()).toThrow("workspace");
  });
  it("preserves the normal database client when evaluation mode is disabled", () => {
    const context = new AsyncLocalStorage<{
      prisma: { value: string; identity: () => string };
    }>();
    const fallback = {
      value: "normal",
      identity() {
        return this.value;
      },
    };
    expect(scopedClient(fallback, context, () => false).identity()).toBe(
      "normal",
    );
  });
});
describe("respondent coverage", () => {
  it("provides 35 course-role combinations, 150 students, and six tasks per role", () => {
    expect(EVALUATION_COURSES).toHaveLength(7);
    expect(EVALUATION_ROLES).toHaveLength(5);
    expect(EVALUATION_COURSES.reduce((sum, c) => sum + c.quota, 0)).toBe(150);
    for (const role of EVALUATION_ROLES)
      expect(ROLE_TASKS[role.id]).toHaveLength(6);
    for (const course of EVALUATION_COURSES) {
      expect(course.details.length).toBeGreaterThanOrEqual(3);
      expect(course.title).not.toMatch(/sample|demo/i);
      expect(course.feedback.length).toBeGreaterThan(40);
    }
  });
});
