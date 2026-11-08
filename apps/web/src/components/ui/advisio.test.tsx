import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));

import { CountStrip, DateTile, EmptyNote, ListRow, PageBand, SegmentedSwitch, StatusDot, ToggleSwitch } from "./advisio";

describe("shared Advisio UI", () => {
  it("renders statuses as dot text with a tone, never a pill", () => {
    const html = renderToStaticMarkup(<StatusDot tone="waiting">Pending</StatusDot>);
    expect(html).toContain('class="au-status"');
    expect(html).toContain('data-tone="waiting"');
    expect(html).toContain("Pending");
  });

  it("uses the full-colour band only when asked for the home variant", () => {
    expect(renderToStaticMarkup(<PageBand title="Inbox" />)).not.toContain("au-band--home");
    expect(renderToStaticMarkup(<PageBand variant="home" title="Good day" />)).toContain("au-band--home");
  });

  it("puts the page title in a heading and keeps a guide target on it", () => {
    const html = renderToStaticMarkup(<PageBand title="Consultations" titleId="t" guide="g" />);
    expect(html).toMatch(/<h1 id="t" class="au-band-title" data-guide="g">Consultations<\/h1>/);
  });

  it("renders counts as a labelled list and marks waiting counts", () => {
    const html = renderToStaticMarkup(<CountStrip items={[{ label: "To score", value: 2, tone: "waiting" }]} />);
    expect(html).toContain("<dt>To score</dt>");
    expect(html).toContain('data-tone="waiting"');
  });

  it("only makes rows clickable when they have an action", () => {
    expect(renderToStaticMarkup(<ListRow title="A" />)).toMatch(/^<div class="au-row"/);
    expect(renderToStaticMarkup(<ListRow title="A" onClick={() => {}} />)).toMatch(/^<button type="button" class="au-row"/);
  });

  it("exposes switch and toggle state to assistive technology", () => {
    const seg = renderToStaticMarkup(
      <SegmentedSwitch label="Filter" value="all" onChange={() => {}} options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread", count: 3 }]} />,
    );
    expect(seg).toContain('aria-label="Filter"');
    expect(seg).toContain('aria-pressed="true"');
    const toggle = renderToStaticMarkup(<ToggleSwitch checked label="Show assistant" onChange={() => {}} />);
    expect(toggle).toContain('role="switch"');
    expect(toggle).toContain('aria-checked="true"');
  });

  it("gives date tiles one spoken label when provided", () => {
    const html = renderToStaticMarkup(<DateTile top="Nov" bottom="9" label="November 9" />);
    expect(html).toContain('aria-label="November 9"');
  });

  it("renders an empty state with title and explanation", () => {
    const html = renderToStaticMarkup(<EmptyNote title="Nothing yet" text="Items appear here." />);
    expect(html).toContain("Nothing yet");
    expect(html).toContain("Items appear here.");
  });
});
