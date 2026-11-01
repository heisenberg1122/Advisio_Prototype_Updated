import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DriveStorageMetrics } from "./DriveStorageMetrics";
import {
  storageBytes,
  storageValues,
  type StorageQuota,
} from "./drive-storage-metrics";

const quota: StorageQuota = {
  limit: "1000",
  usage: "600",
  usageInDrive: "500",
  checkedAt: "2026-01-01T00:00:00Z",
  attemptedAt: "2026-01-01T00:00:00Z",
  error: null,
};
const render = (snapshot: StorageQuota | null, connected = true) =>
  renderToStaticMarkup(
    <DriveStorageMetrics
      quota={snapshot}
      connected={connected}
      managedBytes={1024}
      fileCount={2}
      refreshing={false}
      refresh={() => {}}
      error={null}
    />,
  );
describe("Drive storage metrics", () => {
  it("calculates remaining capacity without losing integer precision", () => {
    expect(storageValues(quota)).toMatchObject({
      remaining: 400n,
      percent: 60,
    });
    expect(
      storageValues({
        ...quota,
        usage: "9007199254740993",
        limit: "9007199254740994",
      }).remaining,
    ).toBe(1n);
    expect(storageBytes(1024n ** 4n)).toBe("1 TB");
  });
  it("handles zero usage, unknown limits and exceeded capacity", () => {
    expect(storageValues({ ...quota, usage: "0" })).toMatchObject({
      remaining: 1000n,
      percent: 0,
    });
    expect(storageValues({ ...quota, limit: null })).toMatchObject({
      remaining: null,
      percent: null,
    });
    expect(storageValues({ ...quota, limit: "0" }).percent).toBeNull();
    expect(storageValues({ ...quota, usage: "1100" })).toMatchObject({
      remaining: 0n,
      percent: 110,
    });
  });
  it("renders separate metrics, Philippine time and stale data", () => {
    const html = render(quota);
    for (const text of [
      "600 B / 1000 B",
      "400 B",
      "Advisio-managed usage",
      "1 KB",
      "PHT",
      "Outdated",
      "Refresh storage",
    ])
      expect(html).toContain(text);
    expect(html).toContain('aria-valuenow="60"');
  });
  it("does not show stale capacity after disconnect", () => {
    const html = render(quota, false);
    expect(html).not.toContain("600 B");
    expect(html).toContain("Connect Google Drive");
    expect(html).toContain("Not checked yet");
  });
  it("shows missing data and errors without fabricating zero capacity", () => {
    expect(render(null)).toContain("Capacity not reported");
    expect(render(null)).not.toContain('role="progressbar"');
    expect(render({ ...quota, error: "Storage refresh failed" })).toContain(
      "Storage refresh failed",
    );
  });
});
