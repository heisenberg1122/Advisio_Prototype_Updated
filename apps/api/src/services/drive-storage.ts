// Google returns int64 byte counts as strings. Preserve their precision in storage.
export function quotaBytes(value: string | null | undefined): bigint | null {
  if (value == null || !/^\d+$/.test(value)) return null;
  const bytes = BigInt(value);
  return bytes <= 9223372036854775807n ? bytes : null;
}

export function quotaSnapshot(
  quota:
    | {
        limit?: string | null;
        usage?: string | null;
        usageInDrive?: string | null;
      }
    | null
    | undefined,
  checkedAt: Date,
) {
  if (quotaBytes(quota?.usage) === null)
    throw new Error(
      "Google did not report storage usage. Try refreshing later.",
    );
  return {
    quotaLimitBytes: quotaBytes(quota?.limit),
    quotaUsedBytes: quotaBytes(quota?.usage),
    quotaDriveBytes: quotaBytes(quota?.usageInDrive),
    quotaCheckedAt: checkedAt,
    quotaAttemptedAt: checkedAt,
    quotaError: null,
  };
}

export const emptyQuota = {
  quotaLimitBytes: null,
  quotaUsedBytes: null,
  quotaDriveBytes: null,
  quotaCheckedAt: null,
  quotaAttemptedAt: null,
  quotaError: null,
};
