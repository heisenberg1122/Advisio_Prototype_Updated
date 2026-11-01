export type StorageQuota = {
  limit: string | null;
  usage: string | null;
  usageInDrive: string | null;
  checkedAt: string | null;
  attemptedAt: string | null;
  error: string | null;
};

export const STORAGE_FRESH_MS = 15 * 60_000;

export function storageValues(quota?: StorageQuota | null) {
  const parse = (value?: string | null) =>
    value != null && /^\d+$/.test(value) ? BigInt(value) : null;
  const used = parse(quota?.usage);
  const limit = parse(quota?.limit);
  const remaining =
    used !== null && limit !== null ? (limit > used ? limit - used : 0n) : null;
  const percent =
    used !== null && limit !== null && limit > 0n
      ? Number((used * 10000n) / limit) / 100
      : null;
  return { used, limit, remaining, percent };
}

export function storageBytes(value: bigint | null) {
  if (value === null) return "Unavailable";
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  let divisor = 1n;
  let index = 0;
  while (value >= divisor * 1024n && index < units.length - 1) {
    divisor *= 1024n;
    index++;
  }
  return index === 0
    ? `${value} B`
    : `${(Number((value * 10n) / divisor) / 10).toLocaleString("en-PH", { maximumFractionDigits: 1 })} ${units[index]}`;
}
