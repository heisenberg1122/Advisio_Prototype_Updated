import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountActionDetails } from "./AccountActionDetails";

const props = {
  universityId: "TEST-123",
  working: false,
  suspensionReason: "",
  setSuspensionReason: vi.fn(),
  loading: false,
  error: null,
  retry: vi.fn(),
  acknowledged: false,
  setAcknowledged: vi.fn(),
  deletePhrase: "",
  setDeletePhrase: vi.fn(),
};
describe("Account action confirmation", () => {
  it("explains suspension and collects the audit reason", () => {
    const html = renderToStaticMarkup(
      <AccountActionDetails {...props} type="suspend" />,
    );
    expect(html).toContain("Reason for suspension");
    expect(html).toContain("existing sessions");
    expect(html).toContain("Research records remain intact");
    expect(html).not.toContain("delete-confirmation");
  });
  it("requires a loaded preview before acknowledging deletion", () => {
    const html = renderToStaticMarkup(
      <AccountActionDetails {...props} type="delete" loading />,
    );
    expect(html).toContain("Checking linked records");
    expect(html).toMatch(/type="checkbox"[^>]*disabled/);
    expect(html).toContain("delete TEST-123 sudo");
  });
  it("shows shared-work impact and the affected record counts", () => {
    const html = renderToStaticMarkup(
      <AccountActionDetails
        {...props}
        type="delete"
        preview={{
          token: "test",
          totalRecords: 8,
          files: 2,
          affectedOtherUsers: 3,
          records: [{ type: "ResearchProject", count: 1 }],
        }}
      />,
    );
    expect(html).toContain("3 other users");
    expect(html).toContain("Research Project");
    expect(html).toContain(
      "One administrator deletion audit entry is retained",
    );
    expect(html).not.toMatch(/type="checkbox"[^>]*disabled/);
  });
  it("keeps acknowledgement disabled when a cached preview failed to refresh", () => {
    const html = renderToStaticMarkup(
      <AccountActionDetails
        {...props}
        type="delete"
        error="Could not refresh"
        preview={{
          token: "old",
          totalRecords: 8,
          files: 2,
          affectedOtherUsers: 3,
          records: [],
        }}
      />,
    );
    expect(html).toContain("Retry preview");
    expect(html).toMatch(/type="checkbox"[^>]*disabled/);
    expect(html).not.toContain("Deletion impact:");
  });
});
