import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuditTrail } from "./AuditTrail";

function render(configured: boolean) {
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
});
