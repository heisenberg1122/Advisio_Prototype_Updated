import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the presentation callbacks without a server or persistent records.
const harness = vi.hoisted(() => ({ states: [] as any[], stateIndex: 0, canSubmit: true, hasDocuments: true }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: any) => {
    const index = harness.stateIndex++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: any) => {
      harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value;
    }];
  },
  useEffect: () => {},
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: any) => queryKey[0] === "task-submission-options"
    ? { data: { availability: { canSubmit: harness.canSubmit, reasons: [{ message: "The current review state does not accept another submission." }] }, task: { allowedFileTypes: ["PDF"] }, options: harness.hasDocuments ? [storedOption] : [], unavailableOptionReasons: [] } }
    : { data: { milestones: [] } },
}));
import { MilestoneDetailsWorkspace } from "./page";

const storedOption = {
  kind: "STORED_VERSION",
  document: { id: "document-a", title: "Selected manuscript" },
  version: { id: "version-a", versionNumber: 2, fileName: "manuscript.pdf" },
};
const baseProps = () => ({
  backHref: "/student/tasks?projectId=project-a",
  task: { id: "task-a", title: "Research requirement", allowedFileTypes: "PDF,DOCX", stage: { id: "stage-a", name: "Title proposal", sequence: 1 }, locked: false },
  project: { id: "project-a", workflowInstance: { currentStage: { sequence: 1 } } },
  members: [], adviser: null, isLeader: true,
  file: new File(["local test only"], "requirement.pdf", { type: "application/pdf" }),
  note: "", message: null, submitting: false, starting: false,
  onFile: vi.fn(), onNote: vi.fn(), onStart: vi.fn(),
  onSubmitUpload: vi.fn().mockResolvedValue(undefined),
  onSubmitDocument: vi.fn().mockResolvedValue(undefined), onOpenSigned: vi.fn(),
});
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.footer)];
}
function confirmation(props: ReturnType<typeof baseProps>) {
  harness.stateIndex = 0;
  const tree = MilestoneDetailsWorkspace(props);
  const element = nodes(tree).find(node => node.type?.name === "SubmissionConfirmation");
  expect(element).toBeDefined();
  return element;
}
function modal(props: ReturnType<typeof baseProps>) {
  const element = confirmation(props);
  return element.type(element.props);
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.states = ["upload", null, null, "upload", null];
  harness.canSubmit = true;
  harness.hasDocuments = true;
});

describe("academic task workspace presentation", () => {
  function workspace(props = baseProps()) {
    harness.stateIndex = 0;
    return MilestoneDetailsWorkspace(props);
  }
  it("places available submission choices after instructions and before history/materials in DOM order", () => {
    harness.states = ["choose", null, null, null, null];
    const tree = workspace();
    const all = nodes(tree);
    const position = (text: string) => all.findIndex(n => n.props?.children === text);
    expect(position("Professor instructions")).toBeLessThan(position("How would you like to submit?"));
    expect(position("How would you like to submit?")).toBeLessThan(position("Submission history"));
    expect(position("Submission history")).toBeLessThan(all.findIndex(n => n.type?.name === "StudentMilestoneAttachments"));
    const surface = all.find(n => n.props?.className === "td-document");
    expect(surface.type).toBe("article");
    expect(all.filter(n => n.type === "h1")).toHaveLength(1);
    expect(all.filter(n => n.type === "main")).toHaveLength(0);
  });
  it("retains unavailable document choices, upload availability and the existing routes", () => {
    harness.states = ["choose", null, null, null, null];
    harness.hasDocuments = false;
    const tree = workspace();
    const choice = (text: string) => nodes(tree).find(n => n.type === "button" && nodes(n).some(c => c.props?.children === text));
    expect(choice("Choose from Documents").props.disabled).toBe(true);
    expect(choice("Choose from Documents").props['aria-describedby']).toBe("no-document-options");
    expect(choice("Upload File").props.disabled).toBe(false);
    expect(nodes(tree).some(n => n.props?.to === "/student/documents?projectId=project-a&milestoneId=stage-a&taskId=task-a")).toBe(true);
  });
  it("does not replace an unavailable submission state with interactive choices", () => {
    harness.states = ["choose", null, null, null, null];
    harness.canSubmit = false;
    const all = nodes(workspace());
    expect(all.some(n => n.props?.children === "Submission is not currently available")).toBe(true);
    expect(all.some(n => n.props?.children === "The current review state does not accept another submission.")).toBe(true);
    expect(all.some(n => n.props?.children === "Upload File")).toBe(false);
  });
  it("keeps the completed label and server-eligible submission controls together without reinterpreting progress", () => {
    harness.states = ["choose", null, null, null, null];
    const props = baseProps();
    props.project.workflowInstance.currentStage.sequence = 2;
    const all = nodes(workspace(props));
    expect(all.some(n => n.props?.children === "COMPLETED")).toBe(true);
    expect(all.some(n => n.props?.children === "How would you like to submit?")).toBe(true);
  });
  it("consolidates contextual sections in information/progress/group order and retains 0% progress", () => {
    const tree=workspace();
    const panel=nodes(tree).find(n=>n.type?.name==='MilestoneInformationPanel');
    const content=panel.type({...panel.props, progress:{totalRequirements:1,completedRequirements:0,completionPercent:0}});
    expect(content.type).toBe('aside');
    expect(content.props.className).toBe('td-context');
    expect(nodes(content).filter(n=>n.type==='h2').map(n=>n.props.children)).toEqual(['Milestone information','Milestone progress','Research group']);
    const track=nodes(content).find(n=>n.props?.role==='progressbar');
    expect(track.props['aria-valuenow']).toBe(0);
    expect(track.props['aria-valuemax']).toBe(100);
    expect(track.props.children.props.style.width).toBe('0%');
  });
});

describe("task submission confirmation UX", () => {
  it("retains a long original filename and keeps its extension with the filename ending", () => {
    const filename = "Accountancy_Research_Manuscript_Final_Version_With_Long_Original_Filename.pdf";
    const props = { ...baseProps(), file: new File(["test"], filename, { type: "application/pdf" }) };
    const result = modal(props);
    const body = renderToStaticMarkup(<div>{result.props.children}</div>);
    expect(body).toContain(`title="${filename}"`);
    expect(body).toContain('class="task-submission-filename-ending">Filename.pdf</span>');
    expect(body).toContain("<wbr/>");
    const documentRow = body.split('data-field="document"')[1].split('</dd>')[0];
    expect(documentRow.replace(/<[^>]*>/g, "")).toContain(filename);
  });
  it("preserves every metadata value and the exact submission warning", () => {
    const props = baseProps();
    props.task.title = "Long task destination that must remain intact even when it wraps across several lines";
    const body = renderToStaticMarkup(<div>{modal(props).props.children}</div>);
    for (const label of ['Document', 'Version', 'Format', 'Destination']) expect(body).toContain(`<dt>${label}</dt>`);
    expect(body).toContain("Uploaded file snapshot");
    expect(body).toContain("PDF");
    expect(body).toContain(`${props.task.stage.name} · ${props.task.title}`);
    expect(body).toContain("The submitted version will be frozen for faculty review. Later revisions create a new attempt and do not overwrite this submission.");
  });
  it("retains the extra Google snapshot warning and document title without changing the selection", () => {
    const props = baseProps();
    const element = confirmation(props);
    const googleOption = { kind: 'GOOGLE_DOC_PDF_SNAPSHOT', document: { id: 'google-a', title: 'Accountancy Research Working Copy' }, snapshot: { outputFileType: 'PDF' } };
    const result = element.type({ ...element.props, mode: 'documents', option: googleOption });
    const body = renderToStaticMarkup(<div>{result.props.children}</div>);
    expect(body).toContain('title="Accountancy Research Working Copy"');
    expect(body).toContain("Advisio will verify Google Drive access and export the live document as PDF when you confirm.");
    expect(body).toContain("New immutable PDF snapshot");
  });
  it("closes after a successful upload even when refreshed data clears the file", async () => {
    const props = baseProps();
    let resolve!: () => void;
    props.onSubmitUpload.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const pending = confirmation(props).props.onConfirm();
    expect(props.onSubmitUpload).toHaveBeenCalledTimes(1);
    expect(confirmation({ ...props, file: null as any, submitting: true }).props.mode).toBe("upload");
    resolve();
    await pending;
    expect(confirmation({ ...props, file: null as any }).props.mode).toBeNull();
  });
  it("keeps a failed upload open with its file and an actionable error", async () => {
    const props = baseProps();
    props.onSubmitUpload.mockRejectedValue(new Error("The upload could not be completed."));
    await confirmation(props).props.onConfirm();
    const result = confirmation(props);
    expect(result.props.mode).toBe("upload");
    expect(result.props.file).toBe(props.file);
    expect(result.props.error).toBe("The upload could not be completed.");
  });
  it("closes after exact-version success without changing its callback arguments", async () => {
    harness.states = ["documents", "STORED_VERSION:document-a:version-a", { scope: "STORED_VERSION:document-a:version-a", value: "stable-key" }, "documents", null];
    const props = baseProps();
    await confirmation(props).props.onConfirm();
    expect(props.onSubmitDocument).toHaveBeenCalledExactlyOnceWith(storedOption, "stable-key");
    expect(confirmation(props).props.mode).toBeNull();
  });
  it("keeps an exact-version failure open for retry", async () => {
    harness.states = ["documents", "STORED_VERSION:document-a:version-a", { value: "stable-key" }, "documents", null];
    const props = baseProps();
    props.onSubmitDocument.mockRejectedValue(new Error("The document is no longer eligible."));
    await confirmation(props).props.onConfirm();
    expect(confirmation(props).props.mode).toBe("documents");
    expect(confirmation(props).props.error).toBe("The document is no longer eligible.");
  });
  it("keeps the missing-file guard and explains why confirmation is disabled", () => {
    const result = modal({ ...baseProps(), file: null as any });
    const footer = renderToStaticMarkup(<div>{result.props.footer}</div>);
    const body = renderToStaticMarkup(<div>{result.props.children}</div>);
    expect(footer).toMatch(/<button[^>]*disabled=""[^>]*class="[^"]*task-submission-confirm/);
    expect(footer).toContain('<span class="sr-only">Confirm submission</span>');
    expect(body).toContain("Choose Go back to select one before confirming.");
    expect(result.props.title).toBe("Confirm submission");
  });
  it("announces progress and prevents Go back while the existing request is pending", () => {
    const props = { ...baseProps(), submitting: true };
    const result = modal(props);
    const footer = renderToStaticMarkup(<div>{result.props.footer}</div>);
    expect(footer).toContain('<span class="sr-only">Submitting…</span>');
    expect(footer).toContain('aria-busy="true"');
    expect(footer.match(/disabled=""/g)).toHaveLength(2);
    expect(renderToStaticMarkup(<div>{result.props.children}</div>)).toContain("Please keep this page open.");
    confirmation(props).props.onClose();
    expect(confirmation(props).props.mode).toBe("upload");
  });
});
