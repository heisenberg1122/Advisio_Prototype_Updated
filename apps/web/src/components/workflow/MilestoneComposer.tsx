import React, { useEffect, useRef } from "react";

type MilestoneComposerProps = {
  mode: "create" | "edit";
  workflowName: string;
  topics: Array<{ id: string; title: string }>;
  topicId: string;
  title: string;
  instructions: string;
  targetCompletionDate: string;
  legacyDeadlineDays?: number | null;
  submissionMode: string;
  requiresDocument: boolean;
  requiresApproval: boolean;
  category: string;
  milestoneType?: "STANDARD" | "ADVISER_SELECTION";
  position?: string;
  positionOptions?: Array<{ value: string; label: string }>;
  saving: boolean;
  advancedOpen: boolean;
  requirementsContent?: React.ReactNode;
  attachmentsContent?: React.ReactNode;
  onTitleChange: (value: string) => void;
  onTopicIdChange: (value: string) => void;
  onInstructionsChange: (value: string) => void;
  onTargetCompletionDateChange: (value: string) => void;
  onSubmissionModeChange: (value: string) => void;
  onRequiresDocumentChange: (value: boolean) => void;
  onRequiresApprovalChange: (value: boolean) => void;
  onCategoryChange: (value: string) => void;
  onPositionChange?: (value: string) => void;
  onAdvancedOpenChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onDelete?: () => void;
  saveStatus?: "idle" | "saving" | "saved";
  prerequisiteLabel?: string;
  reviewerLabel?: string;
};

export function MilestoneComposer({
  mode,
  workflowName,
  topics,
  topicId,
  title,
  instructions,
  targetCompletionDate,
  legacyDeadlineDays,
  submissionMode,
  requiresDocument,
  requiresApproval,
  category,
  milestoneType = "STANDARD",
  position = "",
  positionOptions = [],
  saving,
  advancedOpen,
  requirementsContent,
  attachmentsContent,
  onTitleChange,
  onTopicIdChange,
  onInstructionsChange,
  onTargetCompletionDateChange,
  onSubmissionModeChange,
  onRequiresDocumentChange,
  onRequiresApprovalChange,
  onCategoryChange,
  onPositionChange,
  onAdvancedOpenChange,
  onClose,
  onSubmit,
  onDelete,
  saveStatus = "idle",
  prerequisiteLabel = "Previous milestone in the published sequence",
  reviewerLabel = "Professor / Research Coordinator",
}: MilestoneComposerProps) {
  const currentSignature = JSON.stringify({
    title,
    topicId,
    instructions,
    targetCompletionDate,
    legacyDeadlineDays,
    submissionMode,
    requiresDocument,
    requiresApproval,
    category,
    milestoneType,
    position,
  });
  const initialSignature = useRef(currentSignature);
  const hasUnsavedChanges =
    currentSignature !== initialSignature.current && saveStatus !== "saved";
  const requestClose = () => {
    if (saving) return;
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard your unsaved milestone changes?")
    )
      return;
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
  const isAdviserMilestone = milestoneType === "ADVISER_SELECTION";

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[var(--color-background)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-composer-title"
    >
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-xs sm:px-6">
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
              <h2
                id="milestone-composer-title"
                className="truncate text-lg font-extrabold text-[#102f49] sm:text-xl"
              >
                {isCreate ? "New milestone" : "Edit milestone"}
              </h2>
              <p className="truncate text-sm text-slate-500">
                {workflowName || "Research workflow"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saveStatus === "saved" && (
              <span className="hidden text-sm font-bold text-emerald-600 sm:inline">
                <i className="ti ti-circle-check-filled mr-1" />
                Saved
              </span>
            )}
            <button
              type="submit"
              disabled={saving || title.trim().length < 3 || !topicId}
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
                <label
                  htmlFor="milestone-title"
                  className="block text-sm font-extrabold text-slate-700"
                >
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
                <label
                  htmlFor="milestone-instructions"
                  className="mt-6 block text-sm font-extrabold text-slate-700"
                >
                  Instructions{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="milestone-instructions"
                  rows={8}
                  maxLength={4000}
                  value={instructions}
                  onChange={(event) => onInstructionsChange(event.target.value)}
                  placeholder="Explain what researchers need to complete and what a successful submission should contain."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-base leading-6 text-slate-700 outline-none transition focus:border-[#f6a800] focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
                {isAdviserMilestone && (
                  <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <i className="ti ti-user-check mt-0.5 text-xl text-amber-700" />
                    <div>
                      <strong className="block">
                        Completed by adviser acceptance
                      </strong>
                      <span className="mt-1 block leading-5">
                        The group leader selects an eligible adviser from the
                        existing Adviser Pool. This milestone is approved
                        automatically when that adviser accepts.
                      </span>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-[#102f49]">
                      Submission requirements
                    </h3>
                    <p className="mt-1 text-base text-slate-500">
                      Choose whether researchers must upload a deliverable for
                      this milestone.
                    </p>
                  </div>
                  {!isAdviserMilestone && (
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={requiresDocument}
                        onChange={(event) =>
                          onRequiresDocumentChange(event.target.checked)
                        }
                        className="peer sr-only"
                      />
                      <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[#173f63] after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
                    </label>
                  )}
                </div>
                {isAdviserMilestone ? (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <strong className="block">
                      No document upload required
                    </strong>
                    <span className="mt-1 block text-xs leading-5 text-emerald-800">
                      Adviser request, eligibility, acceptance, timestamps, and
                      workflow advancement are synchronized by the server.
                    </span>
                  </div>
                ) : requiresDocument ? (
                  requirementsContent || (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
                      <div className="flex gap-3">
                        <i className="ti ti-file-upload mt-0.5 text-lg text-blue-700" />
                        <div>
                          <strong className="block">
                            One document submission will be created
                          </strong>
                          <span className="mt-1 block text-xs leading-5 text-blue-800">
                            It will use the milestone title and accept PDF or
                            DOCX files. You can add or refine requirements after
                            creating the milestone.
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    Researchers will see the instructions but will not be asked
                    to upload a document.
                  </div>
                )}
              </section>

              {attachmentsContent}

              {!isCreate && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-extrabold text-rose-700 transition hover:bg-rose-50"
                >
                  <i className="ti ti-trash mr-1.5" />
                  Remove milestone
                </button>
              )}
            </main>

            <aside className="h-fit space-y-4 lg:sticky lg:top-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-extrabold text-[#102f49]">
                  Milestone settings
                </h3>
                <div className="mt-5 space-y-5">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Workflow
                    </span>
                    <p className="mt-1.5 text-base font-bold text-[#102f49]">
                      {workflowName || "Not selected"}
                    </p>
                  </div>
                  <label className="block text-sm font-bold text-slate-700">
                    Topic <span className="text-rose-600">*</span>
                    <select
                      value={topicId}
                      onChange={(event) => onTopicIdChange(event.target.value)}
                      required
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-normal"
                    >
                      <option value="">Choose a topic</option>
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {isAdviserMilestone ? (
                    <div>
                      <span className="block text-sm font-bold text-slate-700">
                        Completed by
                      </span>
                      <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-700">
                        Research group · official adviser acceptance
                      </div>
                    </div>
                  ) : (
                    <label className="block text-sm font-bold text-slate-700">
                      Completed by
                      <select
                        value={submissionMode}
                        onChange={(event) =>
                          onSubmissionModeChange(event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-normal"
                      >
                        <option value="GROUP">Research group</option>
                        <option value="INDIVIDUAL">
                          Individual researcher
                        </option>
                        <option value="EITHER">Individual or group</option>
                      </select>
                    </label>
                  )}
                  {isCreate &&
                    onPositionChange &&
                    positionOptions.length > 0 && (
                      <label className="block text-sm font-bold text-slate-700">
                        Position in topic
                        <select
                          value={position}
                          onChange={(event) =>
                            onPositionChange(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-normal"
                        >
                          {positionOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  <label className="block text-sm font-bold text-slate-700">
                    Target completion
                    <div className="relative mt-1.5">
                      <input
                        id="milestone-target-completion"
                        type="date"
                        value={targetCompletionDate}
                        onChange={(event) =>
                          onTargetCompletionDateChange(event.target.value)
                        }
                        aria-describedby="milestone-target-help"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-normal"
                      />
                    </div>
                    <span
                      id="milestone-target-help"
                      className="mt-1 block text-xs font-normal leading-5 text-slate-400"
                    >
                      {legacyDeadlineDays != null
                        ? `Current target: ${legacyDeadlineDays} days after availability. Choose a date to replace it.`
                        : "Optional. Due by the end of this date (Philippine time)."}
                    </span>
                    {(targetCompletionDate || legacyDeadlineDays != null) && (
                      <button
                        type="button"
                        onClick={() => onTargetCompletionDateChange("")}
                        className="mt-1 text-xs font-semibold text-[#173f63] underline"
                      >
                        Clear target
                      </button>
                    )}
                  </label>
                  {isAdviserMilestone ? (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <i className="ti ti-lock-check mt-0.5 text-lg text-emerald-700" />
                      <span>
                        <span className="block text-sm font-bold text-emerald-900">
                          Automatic approval gate
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-emerald-700">
                          No professor approval is required after the adviser
                          accepts.
                        </span>
                      </span>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <input
                        type="checkbox"
                        checked={requiresApproval}
                        onChange={(event) =>
                          onRequiresApprovalChange(event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 accent-[#173f63]"
                      />
                      <span>
                        <span className="block text-sm font-bold text-[#102f49]">
                          Approval required
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          Researchers cannot continue until this milestone is
                          approved.
                        </span>
                      </span>
                    </label>
                  )}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                    <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                      Prerequisite
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">
                      {prerequisiteLabel}
                    </span>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                    <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                      Reviewer and approval rule
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">
                      {isAdviserMilestone
                        ? "The selected faculty adviser completes this gate only by accepting the official adviser request."
                        : requiresApproval
                          ? `${reviewerLabel} must approve every required submission before the next milestone unlocks.`
                          : "Required submissions must be completed before the next milestone unlocks; no separate faculty approval gate is added."}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <button
                  type="button"
                  onClick={() => onAdvancedOpenChange(!advancedOpen)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span>
                    <span className="block font-extrabold text-[#102f49]">
                      Advanced settings
                    </span>
                    <span className="text-sm text-slate-500">
                      Most milestones use the default type.
                    </span>
                  </span>
                  <i
                    className={`ti ${advancedOpen ? "ti-chevron-up" : "ti-chevron-down"}`}
                  />
                </button>
                {advancedOpen &&
                  (isAdviserMilestone ? (
                    <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold text-[#102f49]">
                      Adviser Milestone
                    </div>
                  ) : (
                    <label className="mt-4 block text-sm font-bold text-slate-700">
                      Milestone type
                      <select
                        value={category}
                        onChange={(event) =>
                          onCategoryChange(event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-normal"
                      >
                        <option value="Milestone">Standard milestone</option>
                        <option value="Compliance">
                          Compliance requirement
                        </option>
                        <option value="Pre-requisite">
                          Approval checkpoint
                        </option>
                      </select>
                    </label>
                  ))}
              </section>
            </aside>
          </div>
        </div>
      </form>
    </div>
  );
}
