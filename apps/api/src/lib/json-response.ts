/** Prisma BigInts must be converted at the response boundary, including nested versions. */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, entry) => {
      if (typeof entry !== "bigint") return entry;
      return entry <= BigInt(Number.MAX_SAFE_INTEGER) &&
        entry >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(entry)
        : entry.toString();
    }),
  );
}
