import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountActionDetails } from "./AccountActionDetails";

const props = {
  working: false,
  suspensionReason: "",
  setSuspensionReason: vi.fn(),
};
describe("Account action confirmation", () => {
  it("explains suspension and collects the audit reason", () => {
    const html = renderToStaticMarkup(
      <AccountActionDetails {...props} type="suspend" />,
    );
    expect(html).toContain("Reason for suspension");
    expect(html).toContain("existing sessions");
    expect(html).toContain("Research records remain intact");
  });
  it("explains archive preservation, access revocation, and verified restoration", () => {
    const html = renderToStaticMarkup(
      <AccountActionDetails {...props} type="archive" />,
    );
    expect(html).toContain("Reason for archiving");
    expect(html).toContain("Archived users");
    expect(html).toContain(
      "All records and files, including shared research work, remain intact",
    );
    expect(html).toContain("identity verification");
    expect(html).not.toContain("delete-confirmation");
    expect(html).not.toContain("permanently delete");
  });
});
