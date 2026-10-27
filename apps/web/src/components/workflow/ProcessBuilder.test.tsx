import React, { type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MilestoneComposer } from "./MilestoneComposer";
import { ProcessSequencePreview } from "./ProcessSequencePreview";
import { WorkflowResourcesCard } from "./WorkflowResourcesCard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const props: ComponentProps<typeof MilestoneComposer> = {
  mode: "create",
  workflowName: "Thesis Process Template",
  topics: [],
  topicId: "",
  title: "Submit proposal",
  instructions: "",
  targetCompletionDate: "",
  submissionMode: "EITHER",
  requiresDocument: false,
  requiresApproval: false,
  category: "Milestone",
  saving: false,
  advancedOpen: true,
  onTitleChange: vi.fn(),
  onTopicIdChange: vi.fn(),
  onInstructionsChange: vi.fn(),
  onTargetCompletionDateChange: vi.fn(),
  onSubmissionModeChange: vi.fn(),
  onRequiresDocumentChange: vi.fn(),
  onRequiresApprovalChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onRequiredMilestoneChange: vi.fn(),
  onAdvancedOpenChange: vi.fn(),
  onClose: vi.fn(),
  onSubmit: vi.fn(),
};
describe("Process Builder rendering", () => {
  it("uses Process terminology in coordinator resources and preserves the researcher copy", () => {
    const client = new QueryClient();
    const render = (canManage: boolean) =>
      renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <WorkflowResourcesCard canManage={canManage} />
        </QueryClientProvider>,
      );
    expect(render(true)).toContain(
      "Select a process to view its shared resources.",
    );
    expect(render(true)).not.toContain("entire workflow");
    expect(render(false)).toContain(
      "Select or join a workflow to view its shared resources.",
    );
    client.clear();
  });
  it.each(["create", "edit"] as const)(
    "%s allows an empty optional Phase and does not auto-select/create one",
    (mode) => {
      const change = vi.fn();
      const html = renderToStaticMarkup(
        <MilestoneComposer
          {...props}
          mode={mode}
          topics={[{ id: "phase", title: "Proposal Phase" }]}
          onTopicIdChange={change}
        />,
      );
      expect(html).toContain("No Phase / Unassigned");
      expect(html).toMatch(
        /<option value="" selected="">No Phase \/ Unassigned/,
      );
      expect(html).not.toMatch(/<select[^>]*required/);
      expect(html).not.toMatch(/<button[^>]*type="submit"[^>]*\sdisabled=""/);
      expect(change).not.toHaveBeenCalled();
      expect(html).not.toMatch(
        /Workflow Topic|Workflow Stage|New milestone|Milestone details/,
      );
    },
  );
  it("uses Process, Phase, Requirement and special-type labels", () => {
    const html = renderToStaticMarkup(
      <MilestoneComposer {...props} milestoneType="DEFENSE_ELIGIBILITY" />,
    );
    for (const label of [
      "Process Template",
      "Phase",
      "Requirement",
      "Defense Eligibility Requirement",
    ])
      expect(html).toContain(label);
    expect(html).not.toContain(">DEFENSE_ELIGIBILITY<");
  });
  it("still disables save while pending or without a title", () => {
    expect(
      renderToStaticMarkup(<MilestoneComposer {...props} saving />),
    ).toMatch(/<button[^>]*type="submit"[^>]*\sdisabled=""/);
    expect(
      renderToStaticMarkup(<MilestoneComposer {...props} title="" />),
    ).toMatch(/<button[^>]*type="submit"[^>]*\sdisabled=""/);
  });
  it("renders mixed and unassigned Requirements in saved sequence", () => {
    const html = renderToStaticMarkup(
      <ProcessSequencePreview
        phases={[{ id: "phase", title: "Proposal" }]}
        requirements={[
          { id: "three", title: "Third ethics", sequence: 3, topicId: null },
          {
            id: "two",
            title: "Second proposal",
            sequence: 2,
            topicId: "phase",
            requiresDocument: true,
            tasks: [{ isRequired: true }],
          },
          { id: "one", title: "First profile", sequence: 1, topicId: null },
          {
            id: "old",
            title: "Hidden archive",
            sequence: -1,
            scope: "Archived",
          },
        ]}
      />,
    );
    expect(html.indexOf("First profile")).toBeLessThan(
      html.indexOf("Second proposal"),
    );
    expect(html.indexOf("Second proposal")).toBeLessThan(
      html.indexOf("Third ethics"),
    );
    expect(html.match(/Unassigned Requirement · No Phase/g)).toHaveLength(2);
    expect(html).toContain("Phase: Proposal");
    expect(html).toContain("Submission Items");
    expect(html).not.toContain("Hidden archive");
  });
  it("renders fully phased processes and zero-Phase processes", () => {
    for (const topicId of [null, "phase"]) {
      const html = renderToStaticMarkup(
        <ProcessSequencePreview
          phases={topicId ? [{ id: "phase", title: "Existing" }] : []}
          requirements={[
            { id: "one", title: "Existing requirement", sequence: 1, topicId },
          ]}
        />,
      );
      expect(html).toContain("Existing requirement");
      expect(html).toContain(
        topicId ? "Phase: Existing" : "Unassigned Requirement",
      );
    }
  });
});
