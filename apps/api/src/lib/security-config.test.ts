import { describe, expect, it } from "vitest";
import { isAllowedOrigin, resolveJwtSecret } from "./security-config.js";
import { jsonSafe } from "./json-response.js";

describe("production authentication and browser origin configuration", () => {
  it.each([
    undefined,
    "short",
    "advisio-super-secret-key-change-in-production",
    "advisio-dev-secret-key-change-in-production",
  ])("rejects unsafe production secrets", (JWT_SECRET) => {
    expect(() =>
      resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET }),
    ).toThrow();
  });
  it("does not use a predictable unconfigured development key", () => {
    expect(resolveJwtSecret({})).not.toBe(resolveJwtSecret({}));
  });
  it("accepts only exact configured origins", () => {
    const config = {
      NODE_ENV: "production",
      CORS_ORIGIN: "https://school.example",
    };
    expect(isAllowedOrigin("https://school.example", config)).toBe(true);
    expect(
      isAllowedOrigin("https://school.example.attacker.test", config),
    ).toBe(false);
    expect(isAllowedOrigin("https://unrelated.vercel.app", config)).toBe(false);
    expect(isAllowedOrigin("https://localhost.attacker.test", config)).toBe(
      false,
    );
    expect(isAllowedOrigin(undefined, config)).toBe(true);
  });
  it("limits implicit localhost allowances to development without an explicit allowlist", () => {
    expect(isAllowedOrigin("http://localhost:3000", {})).toBe(true);
    expect(
      isAllowedOrigin("http://localhost:3000", { NODE_ENV: "production" }),
    ).toBe(false);
    expect(
      isAllowedOrigin("http://localhost:3000", {
        CORS_ORIGIN: "https://school.example",
      }),
    ).toBe(false);
  });
  it("preserves exact BigInts beyond the JavaScript safe integer range", () => {
    expect(jsonSafe({ small: 123n, large: 9007199254740993n })).toEqual({
      small: 123,
      large: "9007199254740993",
    });
  });
});
