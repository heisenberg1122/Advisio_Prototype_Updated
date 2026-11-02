import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";

export type EvaluationScope = {
  id: string;
  prisma: PrismaClient;
  storageRoot: string;
};
export const evaluationContext = new AsyncLocalStorage<EvaluationScope>();

// Resolve delegates at call time: concurrent requests must never share a tenant.
export function scopedClient<T extends object>(
  fallback: T,
  context: AsyncLocalStorage<{ prisma: T }>,
  enabled: () => boolean,
): T {
  return new Proxy(fallback, {
    get(_target, key) {
      const client = context.getStore()?.prisma;
      if (!client && enabled())
        throw new Error(
          "An evaluation workspace is required for database access.",
        );
      const owner = client || fallback;
      const value = Reflect.get(owner, key, owner);
      return typeof value === "function" ? value.bind(owner) : value;
    },
  });
}
