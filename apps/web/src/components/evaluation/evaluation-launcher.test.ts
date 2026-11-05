import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const script = readFileSync(new URL("../../../public/evaluation-launcher.js", import.meta.url), "utf8");
const ready = { status: "ok", mode: "evaluation", database: "connected" };
const response = (health: unknown, type = "application/json", ok = true) => ({
  ok,
  headers: { get: () => type },
  json: async () => health,
});

function launch(fetch: ReturnType<typeof vi.fn>, search = "") {
  const elements = new Map(
    ["startup-title", "startup-message", "startup-retry", ".loading-dots"].map(id => [id, {
      textContent: "", hidden: false, addEventListener: vi.fn(),
    }]),
  );
  const events = new Map<string, (event?: unknown) => void>();
  const replace = vi.fn();
  new Function("window", "document", "fetch", script)(
    { location: { search, replace }, addEventListener: (name: string, callback: () => void) => events.set(name, callback) },
    { getElementById: (id: string) => elements.get(id), querySelector: (selector: string) => elements.get(selector) },
    fetch,
  );
  return { elements, events, replace };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

test("opens only the evaluation origin, preserves assignments, and sends no account credentials", async () => {
  const fetch = vi.fn().mockResolvedValue(response(ready));
  const { replace } = launch(fetch, "?role=student&course=BSIT&redirect=https://other.example&token=private");
  await vi.advanceTimersByTimeAsync(0);
  expect(replace).toHaveBeenCalledWith("https://advisio-tam-evaluation-2026.onrender.com/evaluate?role=student&course=BSIT");
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/evaluate\/status\?t=/), expect.objectContaining({ credentials: "omit", cache: "no-store" }));
});

test.each([
  response(null, "text/html"),
  response(ready, "application/json", false),
  response({ status: "ok" }),
  response({ ...ready, mode: "production" }),
  response({ ...ready, database: "unavailable" }),
])("waits through startup HTML and incomplete health responses", async (initial) => {
  const fetch = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(response(ready));
  const { replace } = launch(fetch);
  await vi.advanceTimersByTimeAsync(0);
  expect(replace).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(3_000);
  expect(replace).toHaveBeenCalledTimes(1);
});

test("stops after two minutes and allows a fresh retry after a network failure", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Service asleep"));
  const { elements, replace } = launch(fetch);
  await vi.advanceTimersByTimeAsync(120_000);
  expect(replace).not.toHaveBeenCalled();
  expect(elements.get("startup-title")!.textContent).toContain("taking longer");
  expect(elements.get("startup-retry")!.hidden).toBe(false);
  expect(elements.get(".loading-dots")!.hidden).toBe(true);
  const calls = fetch.mock.calls.length;
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(calls);
  fetch.mockResolvedValue(response(ready));
  elements.get("startup-retry")!.addEventListener.mock.calls[0][1]();
  await vi.advanceTimersByTimeAsync(0);
  expect(replace).toHaveBeenCalledTimes(1);
});

test("leaving the page stops polling and aborts the active request", async () => {
  const fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
  const { events, replace } = launch(fetch);
  events.get("pagehide")!();
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(150_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
});
