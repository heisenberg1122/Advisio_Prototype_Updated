import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuditTrail } from "./AuditTrail";

function render(
  configured: boolean,
  overrides: { action?: string; outcome?: string; eventType?: string } = {},
) {
  const client = new QueryClient();
  client.setQueryData(["audit-trail", {}, undefined], {
    events: [
      {
        id: "event",
        createdAt: "2026-11-01T00:10:00.000Z",
        actorReference: null,
        actorRoles: [],
        action: "UPDATE",
        eventType: "LOGIN_FAILED",
        entityType: "SecuritySummary",
        category: "SECURITY",
        outcome: "FAILURE",
        contractVersion: 1,
        summaryCount: 12,
        firstOccurredAt: "2026-11-01T00:00:00.000Z",
        lastOccurredAt: "2026-11-01T00:09:00.000Z",
        ...overrides,
      },
    ],
    nextCursor: null,
    security: {
      configured,
      mode: configured ? "shared" : "disabled",
      lastFlushAt: null,
      pending: 0,
      overflow: 0,
      droppedObservations: 0,
      oldestPendingSeconds: 0,
    },
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AuditTrail />
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("audit trail viewer", () => {
  it("identifies grouped failures and does not attribute them to the account owner", () => {
    const html = render(true);
    expect(html).toContain("12 observations");
    expect(html).toContain("System / unauthenticated");
    expect(html).toContain("do not add their counts together");
    expect(html).toContain("Philippine Time");
  });
  it("shows missing security configuration explicitly", () => {
    expect(render(false)).toContain("not configured");
  });
  it("keeps a successful deletion distinct from a failed action", () => {
    const html = render(true, {
      action: "DELETE",
      outcome: "SUCCESS",
      eventType: "DOCUMENT_DELETED",
    });
    expect(html).toMatch(/bg-amber-50[^>]*>.*?delete<\/span>/);
    expect(html).toMatch(/bg-green-50[^>]*>.*?success<\/span>/);
    expect(html).not.toContain("bg-red-50");
  });
  it("preserves unrecognized audit values with neutral badges", () => {
    const html = render(true, {
      action: "FUTURE_ACTION",
      outcome: "PENDING_REVIEW",
    });
    expect(html).toContain("future action");
    expect(html).toContain("pending review");
    expect(html).not.toContain("bg-green-50");
    expect(html).not.toContain("bg-red-50");
  });
});
