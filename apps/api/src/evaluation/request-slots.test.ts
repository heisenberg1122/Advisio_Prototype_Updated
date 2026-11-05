import { describe, expect, it } from "vitest";
import { EvaluationRequestSlots } from "./request-slots.js";

describe("evaluation database concurrency", () => {
  it("serves thirty participants with at most three requests using the database together", async () => {
    const slots = new EvaluationRequestSlots();
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 30 }, async () => {
        const release = await slots.acquire();
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        release();
        release();
      }),
    );
    expect(peak).toBe(3);
    expect(active).toBe(0);
  });

  it("removes disconnected and timed out requests from the queue", async () => {
    const slots = new EvaluationRequestSlots(1, 20);
    const release = await slots.acquire();
    const controller = new AbortController();
    const aborted = expect(
      slots.acquire(controller.signal),
    ).rejects.toMatchObject({ statusCode: 503 });
    controller.abort();
    await aborted;
    await expect(slots.acquire()).rejects.toMatchObject({ statusCode: 503 });
    release();
    const next = await slots.acquire();
    next();
  });
});
