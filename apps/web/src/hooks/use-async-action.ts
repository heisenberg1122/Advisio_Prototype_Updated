"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncActionStatus = "idle" | "pending" | "success" | "error";
export type ActionFeedbackTone = "success" | "error" | "warning";

export interface ActionFeedbackState {
  tone: ActionFeedbackTone;
  message: string;
}

export interface AsyncActionOptions {
  successMessage?: string;
  errorMessage?: string | ((error: unknown) => string);
  successDuration?: number;
}

export function toErrorMessage(
  error: unknown,
  fallback = "The action could not be completed. Please try again.",
) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function createSingleFlightRunner() {
  let active: Promise<unknown> | null = null;

  return {
    run<T>(action: () => Promise<T> | T): Promise<T> {
      if (active) return active as Promise<T>;

      const task = Promise.resolve()
        .then(action)
        .finally(() => {
          if (active === task) active = null;
        });
      active = task;
      return task;
    },
    isRunning() {
      return active !== null;
    },
  };
}

export function useAsyncAction() {
  const runnerRef = useRef<ReturnType<typeof createSingleFlightRunner> | null>(
    null,
  );
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  if (!runnerRef.current) runnerRef.current = createSingleFlightRunner();

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const reset = useCallback(() => {
    clearResetTimer();
    setStatus("idle");
    setFeedback(null);
  }, [clearResetTimer]);

  const warn = useCallback(
    (message: string) => {
      clearResetTimer();
      setStatus("idle");
      setFeedback({ tone: "warning", message });
    },
    [clearResetTimer],
  );

  const fail = useCallback(
    (message: string) => {
      clearResetTimer();
      setStatus("error");
      setFeedback({ tone: "error", message });
    },
    [clearResetTimer],
  );

  const run = useCallback(
    <T>(action: () => Promise<T> | T, options: AsyncActionOptions = {}) =>
      runnerRef.current!.run(async () => {
        clearResetTimer();
        setStatus("pending");
        setFeedback(null);

        try {
          const result = await action();
          setStatus("success");
          setFeedback(
            options.successMessage
              ? { tone: "success", message: options.successMessage }
              : null,
          );

          const successDuration = options.successDuration ?? 2500;
          if (successDuration > 0) {
            resetTimerRef.current = setTimeout(() => {
              setStatus("idle");
              setFeedback(null);
              resetTimerRef.current = null;
            }, successDuration);
          }
          return result;
        } catch (error) {
          const message =
            typeof options.errorMessage === "function"
              ? options.errorMessage(error)
              : (options.errorMessage ?? toErrorMessage(error));
          setStatus("error");
          setFeedback({ tone: "error", message });
          throw error;
        }
      }),
    [clearResetTimer],
  );

  return {
    status,
    feedback,
    isPending: status === "pending",
    run,
    reset,
    warn,
    fail,
  };
}
