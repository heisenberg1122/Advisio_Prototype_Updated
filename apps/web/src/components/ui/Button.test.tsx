import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionFeedback } from "./ActionFeedback";
import { Button, getLoadingLabel } from "./Button";

describe("Button action states", () => {
  it.each([
    ["Submit proposal", "Submitting..."],
    ["Save changes", "Saving..."],
    ["Upload manuscript", "Uploading..."],
    ["Send request", "Sending..."],
    ["Approve account", "Approving..."],
    ["Reject request", "Rejecting..."],
    ["Delete version", "Deleting..."],
    ["Confirm & Sign", "Signing..."],
    ["Login", "Signing in..."],
    ["Finalize manuscript", "Finalizing..."],
  ])("derives descriptive loading text for %s", (label, loadingLabel) => {
    expect(getLoadingLabel(label)).toBe(loadingLabel);
  });

  it("disables and announces a pending action while retaining theme variables", () => {
    const html = renderToStaticMarkup(
      <Button status="pending">Submit proposal</Button>,
    );

    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-action-status="pending"');
    expect(html).toContain("Submitting...");
    expect(html).toContain("animate-spin");
    expect(html).toContain("var(--color-primary)");
  });

  it("uses a green check confirmation only after success", () => {
    const html = renderToStaticMarkup(
      <Button status="success" successText="Saved successfully">
        Save changes
      </Button>,
    );

    expect(html).toContain('data-action-status="success"');
    expect(html).toContain("bg-emerald-600");
    expect(html).toContain("Saved successfully");
    expect(html).toContain("disabled");
  });

  it("shows red retry styling and restores the button after an error", () => {
    const html = renderToStaticMarkup(
      <Button status="error" errorText="Try saving again">
        Save changes
      </Button>,
    );

    expect(html).toContain('data-action-status="error"');
    expect(html).toContain("text-red-700");
    expect(html).toContain("dark:text-red-300");
    expect(html).toContain("Try saving again");
    expect(html).not.toContain(' disabled=""');
  });

  it("keeps all visual labels in one grid cell to avoid action-state layout shifts", () => {
    const html = renderToStaticMarkup(
      <Button status="pending" successText="Uploaded">
        Upload final manuscript
      </Button>,
    );

    expect(html.match(/\[grid-area:1\/1\]/g)).toHaveLength(4);
  });
});

describe("ActionFeedback", () => {
  it("uses an assertive red alert for errors", () => {
    const html = renderToStaticMarkup(
      <ActionFeedback tone="error" message="Upload failed. Try again." />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("text-red-800");
  });

  it("uses polite green and amber status announcements", () => {
    const success = renderToStaticMarkup(
      <ActionFeedback tone="success" message="Changes saved." />,
    );
    const warning = renderToStaticMarkup(
      <ActionFeedback tone="warning" message="Check required fields." />,
    );

    expect(success).toContain('role="status"');
    expect(success).toContain("text-emerald-800");
    expect(warning).toContain("text-amber-900");
  });
});
