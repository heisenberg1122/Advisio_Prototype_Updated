import React, { useEffect, useRef } from "react";

type MilestoneComposerProps = {
  mode: "create" | "edit";
  workflowName: string;
  title: string;
  instructions: string;
  deadlineDays: string;
  submissionMode: string;
  requiresDocument: boolean;
  requiresApproval: boolean;
  category: string;
  saving: boolean;
  advancedOpen: boolean;
  requirementsContent?: React.ReactNode;
  onTitleChange: (value: string) => void;
  onInstructionsChange: (value: string) => void;
  onDeadlineDaysChange: (value: string) => void;
  onSubmissionModeChange: (value: string) => void;
  onRequiresDocumentChange: (value: boolean) => void;
  onRequiresApprovalChange: (value: boolean) => void;
  onCategoryChange: (value: string) => void;
  onAdvancedOpenChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onDelete?: () => void;
  saveStatus?: "idle" | "saving" | "saved";
};

export function MilestoneComposer({
  mode,
  workflowName,
  title,
  instructions,
  deadlineDays,
  submissionMode,
  requiresDocument,
  requiresApproval,
  category,
  saving,
  advancedOpen,
  requirementsContent,
  onTitleChange,
  onInstructionsChange,
  onDeadlineDaysChange,
  onSubmissionModeChange,
  onRequiresDocumentChange,
  onRequiresApprovalChange,
  onCategoryChange,
  onAdvancedOpenChange,
  onClose,
  onSubmit,
  onDelete,
  saveStatus = "idle",
}: MilestoneComposerProps) {
  const currentSignature = JSON.stringify({
    title,
    instructions,
    deadlineDays,
    submissionMode,
    requiresDocument,
    requiresApproval,
    category,
  });
  const initialSignature = useRef(currentSignature);
  const hasUnsavedChanges = currentSignature !== initialSignature.current && saveStatus !== "saved";
  const requestClose = () => {
    if (saving) return;
    if (hasUnsavedChanges && !window.confirm("Discard your unsaved milestone changes?")) return;
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, onClose, saveStatus, saving]);

  const isCreate = mode === "create";

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#f6f8fb]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-composer-title"
    >
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              aria-label="Close milestone composer"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <i className="ti ti-x text-xl" />
            </button>
            <div className="min-w-0">
              <h2 id="milestone-composer-title" className="truncate text-lg font-extrabold text-[#102f49] sm:text-xl">
                {isCreate ? "New milestone" : "Edit milestone"}
              </h2>
              <p className="truncate text-xs text-slate-500">{workflowName || "Research workflow"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saveStatus === "saved" && (
              <span className="hidden text-sm font-bold text-emerald-600 sm:inline">
                <i className="ti ti-circle-check-filled mr-1" />Saved
              </span>
            )}
            <button
              type="submit"
              disabled={saving || title.trim().length < 3}
              className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#102f49] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
            >
              {saving ? "Saving…" : isCreate ? "Add milestone" : "Save changes"}
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-[1180px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-6 lg:p-8">
            <main className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <label htmlFor="milestone-title" className="block text-sm font-extrabold text-slate-700">
                  Milestone title <span className="text-rose-600">*</span>
                </label>
                <input
                  id="milestone-title"
                  required
                  autoFocus
                  maxLength={150}
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder="e.g. Submit research proposal"
                  className="mt-2 w-full border-0 border-b-2 border-slate-200 px-0 py-3 text-lg font-bold text-[#102f49] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#f6a800]"
                />
                <label htmlFor="milestone-instructions" className="mt-6 block text-sm font-extrabold text-slate-700">
                  Instructions <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="milestone-instructions"
                  rows={8}
                  maxLength={4000}
                  value={instructions}
                  onChange={(event) => onInstructionsChange(event.target.value)}
                  placeholder="Explain what researchers need to complete and what a successful submission should contain."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-[#f6a800] focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-[#102f49]">Submission requirements</h3>
                    <p className="mt-1 text-sm text-slate-500">Choose whether researchers must upload a deliverable for this milestone.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={requiresDocument}
                      onChange={(event) => onRequiresDocumentChange(event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[#173f63] after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
                  </label>
                </div>
                {requiresDocument ? (
                  requirementsContent || (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
                      <div className="flex gap-3">
                        <i className="ti ti-file-upload mt-0.5 text-lg text-blue-700" />
                        <div>
                          <strong className="block">One document submission will be created</strong>
                          <span className="mt-1 block text-xs leading-5 text-blue-800">It will use the milestone title and accept PDF or DOCX files. You can add or refine requirements after creating the milestone.</span>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    Researchers will see the instructions but will not be asked to upload a document.
                  </div>
                )}
              </section>

              {!isCreate && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-extrabold text-rose-700 transition hover:bg-rose-50"
                >
                  <i className="ti ti-trash mr-1.5" />Remove milestone
                </button>
              )}
            </main>

            <aside className="h-fit space-y-4 lg:sticky lg:top-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-extrabold text-[#102f49]">Milestone settings</h3>
                <div className="mt-5 space-y-5">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Workflow</span>
                    <p className="mt-1.5 text-sm font-bold text-[#102f49]">{workflowName || "Not selected"}</p>
                  </div>
                  <label className="block text-sm font-bold text-slate-700">
                    Completed by
                    <select
                      value={submissionMode}
                      onChange={(event) => onSubmissionModeChange(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"
                    >
                      <option value="GROUP">Research group</option>
                      <option value="INDIVIDUAL">Individual researcher</option>
                      <option value="EITHER">Individual or group</option>
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Target completion
                    <div className="relative mt-1.5">
                      <input
                        type="number"
                        min="0"
                        max="3650"
                        value={deadlineDays}
                        onChange={(event) => onDeadlineDaysChange(event.target.value)}
                        placeholder="No target"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-14 text-sm font-normal"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">days</span>
                    </div>
                    <span className="mt-1 block text-xs font-normal leading-5 text-slate-400">Relative to when the milestone becomes available.</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={requiresApproval}
                      onChange={(event) => onRequiresApprovalChange(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#173f63]"
                    />
                    <span>
                      <span className="block text-sm font-bold text-[#102f49]">Approval required</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">Researchers cannot continue until this milestone is approved.</span>
                    </span>
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <button
                  type="button"
                  onClick={() => onAdvancedOpenChange(!advancedOpen)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span>
                    <span className="block font-extrabold text-[#102f49]">Advanced settings</span>
                    <span className="text-xs text-slate-500">Most milestones use the default type.</span>
                  </span>
                  <i className={`ti ${advancedOpen ? "ti-chevron-up" : "ti-chevron-down"}`} />
                </button>
                {advancedOpen && (
                  <label className="mt-4 block text-sm font-bold text-slate-700">
                    Milestone type
                    <select
                      value={category}
                      onChange={(event) => onCategoryChange(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"
                    >
                      <option value="Milestone">Standard milestone</option>
                      <option value="Compliance">Compliance requirement</option>
                      <option value="Pre-requisite">Approval checkpoint</option>
                    </select>
                  </label>
                )}
              </section>
            </aside>
          </div>
        </div>
      </form>
    </div>
  );
}
