import { describe, expect, it, vi } from "vitest";
import { retryEvaluationDatabase } from "./database-retry.js";

describe("evaluation database startup", () => {
  it("recovers from the hostname lookup error reported by Render", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("temporary DNS failure"), {
          code: "ENOTFOUND",
        }),
      )
      .mockResolvedValueOnce("ready");
    const pause = vi.fn(async (_ms: number) => undefined);
    await expect(retryEvaluationDatabase(operation, pause)).resolves.toBe(
      "ready",
    );
    expect(pause).toHaveBeenCalledWith(1000);
  });

  it("fails immediately for invalid credentials and stops retrying a persistent outage", async () => {
    const pause = vi.fn(async (_ms: number) => undefined);
    const denied = Object.assign(new Error("invalid credentials"), {
      code: "28P01",
    });
    await expect(
      retryEvaluationDatabase(async () => {
        throw denied;
      }, pause),
    ).rejects.toBe(denied);
    expect(pause).not.toHaveBeenCalled();
    const outage = Object.assign(new Error("temporary DNS failure"), {
      code: "ENOTFOUND",
    });
    await expect(
      retryEvaluationDatabase(async () => {
        throw outage;
      }, pause),
    ).rejects.toBe(outage);
    expect(pause.mock.calls.flat()).toEqual([1000, 2000, 4000, 8000, 8000]);
  });

  it("bounds admission retries and does not retry an unavailable workspace", async () => {
    const pause = vi.fn(async (_ms: number) => undefined);
    const unavailable = Object.assign(new Error("No prepared workspace"), {
      statusCode: 503,
    });
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("timeout exceeded when trying to connect"))
      .mockRejectedValueOnce(unavailable);

    await expect(
      retryEvaluationDatabase(operation, pause, [150, 350, 750]),
    ).rejects.toBe(unavailable);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(pause.mock.calls.flat()).toEqual([150]);
  });
});
