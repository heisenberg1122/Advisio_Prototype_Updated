import { describe, expect, it } from "vitest";
import { quotaBytes, quotaSnapshot } from "./drive-storage.js";

describe("Drive storage quota parsing", () => {
  it("preserves int64 precision and valid zero usage", () => {
    expect(quotaBytes("9007199254740993")).toBe(9007199254740993n);
    expect(quotaSnapshot({ usage: "0" }, new Date()).quotaUsedBytes).toBe(0n);
  });
  it("does not interpret absent capacity as zero", () => {
    expect(
      quotaSnapshot({ usage: "10" }, new Date()).quotaLimitBytes,
    ).toBeNull();
    for (const value of [undefined, "-1", "invalid", "9223372036854775808"])
      expect(quotaBytes(value)).toBeNull();
    expect(() => quotaSnapshot({}, new Date())).toThrow("did not report");
  });
});
