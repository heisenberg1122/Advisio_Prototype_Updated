import { describe, expect, it, vi } from "vitest";
import { createSingleFlightRunner, toErrorMessage } from "./use-async-action";

describe("createSingleFlightRunner", () => {
  it("runs rapid duplicate requests only once and shares the in-flight result", async () => {
    const runner = createSingleFlightRunner();
    let release!: (value: string) => void;
    const action = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const first = runner.run(action);
    const duplicate = runner.run(action);

    expect(first).toBe(duplicate);
    expect(runner.isRunning()).toBe(true);
    await Promise.resolve();
    expect(action).toHaveBeenCalledTimes(1);

    release("saved");
    await expect(first).resolves.toBe("saved");
    expect(runner.isRunning()).toBe(false);
  });

  it("releases the lock after success so a later intentional action can run", async () => {
    const runner = createSingleFlightRunner();
    const action = vi.fn(async () => "done");

    await runner.run(action);
    await runner.run(action);

    expect(action).toHaveBeenCalledTimes(2);
  });

  it("releases the lock after an error so the user can retry", async () => {
    const runner = createSingleFlightRunner();

    await expect(
      runner.run(() => Promise.reject(new Error("Network unavailable"))),
    ).rejects.toThrow("Network unavailable");
    await expect(runner.run(() => Promise.resolve("recovered"))).resolves.toBe(
      "recovered",
    );
  });
});

describe("toErrorMessage", () => {
  it("keeps useful backend errors and supplies a safe fallback", () => {
    expect(toErrorMessage(new Error("Version conflict"))).toBe(
      "Version conflict",
    );
    expect(toErrorMessage(null)).toBe(
      "The action could not be completed. Please try again.",
    );
  });
});
