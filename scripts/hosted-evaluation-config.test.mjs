import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { hostedEvaluationEnvironment } from "./hosted-evaluation-config.mjs";

const source = {
  ADVISIO_EVALUATION: "1",
  EVALUATION_DATABASE_URL:
    "postgresql://evaluation:private@internal-host/advisio_evaluation",
  RENDER_EXTERNAL_URL: "https://evaluation.example.org",
  JWT_SECRET: "a".repeat(48),
  EVALUATION_DATA_DIR: path.resolve("persistent-test"),
  STORAGE_PROVIDER: "LOCAL",
  EMAIL_PROVIDER: "disabled",
  NOTIFICATION_EMAILS_ENABLED: "false",
};
test("hosted startup normalizes only its dedicated database and first-party origin", () => {
  const env = hostedEvaluationEnvironment(source, process.cwd());
  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.CORS_ORIGIN, "https://evaluation.example.org");
  assert.equal(env.WEB_URL, env.CORS_ORIGIN);
  assert.equal(env.DATABASE_URL, env.EVALUATION_DATABASE_URL);
  assert.equal(env.DIRECT_URL, env.DATABASE_URL);
  const url = new URL(env.DATABASE_URL);
  assert.equal(url.searchParams.get("schema"), "public");
  assert.equal(url.searchParams.get("application_name"), "advisio-evaluation");
  assert.equal(env.EVALUATION_BIND_HOST, "0.0.0.0");
  assert.equal(env.EVALUATION_WEB_DIST, path.resolve("apps/web/dist"));
});
test("custom HTTPS domains are supported without changing the shared QR flow", () => {
  const env = hostedEvaluationEnvironment(
    { ...source, EVALUATION_WEB_URL: "https://study.example.org" },
    process.cwd(),
  );
  assert.equal(env.WEB_URL, "https://study.example.org");
  assert.equal(env.CORS_ORIGIN, env.WEB_URL);
});
test("hosted startup rejects production targets, mixed credentials, unsafe origins, and external integrations", () => {
  for (const change of [
    { ADVISIO_EVALUATION: "0" },
    {
      EVALUATION_DATABASE_URL:
        "postgresql://evaluation:private@internal-host/advisio_prod",
    },
    {
      DATABASE_URL: "postgresql://production:private@internal-host/production",
    },
    { DIRECT_URL: "postgresql://production:private@internal-host/production" },
    { EVALUATION_WEB_URL: "http://evaluation.example.org" },
    { EVALUATION_WEB_URL: "https://localhost" },
    { EVALUATION_WEB_URL: "https://user:pass@evaluation.example.org" },
    { EVALUATION_WEB_URL: "https://evaluation.example.org/evaluate" },
    { JWT_SECRET: "short" },
    { EVALUATION_DATA_DIR: "relative/path" },
    { GOOGLE_CLIENT_SECRET: "configured" },
    { EMAIL_PROVIDER: "resend" },
    { STORAGE_PROVIDER: "GOOGLE_DRIVE" },
  ])
    assert.throws(() =>
      hostedEvaluationEnvironment({ ...source, ...change }, process.cwd()),
    );
});
