import { setTimeout as wait } from "node:timers/promises";

const transientCodes = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "57P01",
  "57P02",
  "57P03",
  "08000",
  "08001",
  "08003",
  "08006",
  "53300",
]);

export function evaluationDatabaseErrorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code)
    ? code
    : "unknown";
}

export async function retryEvaluationDatabase<T>(
  operation: () => Promise<T>,
  pause: (ms: number) => Promise<unknown> = wait,
  delays: readonly number[] = [1_000, 2_000, 4_000, 8_000, 8_000],
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const code = evaluationDatabaseErrorCode(error);
      const connectTimeout =
        error instanceof Error &&
        /^(Connection terminated due to connection timeout|timeout exceeded when trying to connect|Connection terminated unexpectedly)$/.test(
          error.message,
        );
      if (
        attempt >= delays.length ||
        (!transientCodes.has(code) && !connectTimeout)
      )
        throw error;
      console.warn(
        "Evaluation database unavailable. Retrying:",
        code,
      );
      await pause(delays[attempt]);
    }
  }
}
