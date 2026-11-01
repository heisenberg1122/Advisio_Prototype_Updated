import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkflowMilestoneActions } from "./WorkflowMilestoneActions";

const stages = [
  { id: "a", topicId: "phase", title: "Adviser" },
  { id: "b", topicId: "phase", title: "Proposal" },
];
const render = (index: number, busy = false) =>
  renderToStaticMarkup(
    <WorkflowMilestoneActions
      milestone={stages[index]}
      stages={stages}
      topics={[{ id: "phase", title: "Requirements" }]}
      busy={busy}
      onMove={vi.fn()}
      onEdit={vi.fn()}
      onDragStart={vi.fn()}
      onDragEnd={vi.fn()}
    />,
  );
describe("milestone move controls", () => {
  it("renders real accessible buttons for arranging and dragging", () => {
    const html = render(0);
    expect(html).toMatch(/<button[^>]*aria-label="Arrange milestone Adviser"/);
    expect(html).toMatch(
      /<button[^>]*draggable="true"[^>]*aria-label="Drag or move Adviser"/,
    );
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).not.toContain("Move Adviser up");
  });
  it("keeps the options menu available at the end of a phase", () => {
    expect(render(1)).toMatch(
      /<button[^>]*aria-label="Arrange milestone Proposal"/,
    );
  });
  it("prevents additional moves while saving", () => {
    const html = render(0, true);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain('draggable="false"');
  });
});
