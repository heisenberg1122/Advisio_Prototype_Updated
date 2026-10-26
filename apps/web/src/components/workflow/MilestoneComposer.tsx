import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MilestoneComposerProps = {
  mode: "create" | "edit";
  presentation?: "overlay" | "panel";
  portalTargetId?: string;
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
  milestoneType?: "STANDARD" | "ADVISER_SELECTION" | "DEFENSE_ELIGIBILITY";
  onMilestoneTypeChange?: (value: "STANDARD" | "DEFENSE_ELIGIBILITY") => void;
  requiredMilestoneId?: string;
  milestoneConditions?: Array<{ value: string; label: string }>;
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
  onRequiredMilestoneChange: (value: string) => void;
  onAdvancedOpenChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onDelete?: () => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  prerequisiteLabel?: string;
  reviewerLabel?: string;
};

export function MilestoneComposer({
  mode,
  presentation = "overlay",
  portalTargetId,
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
  onMilestoneTypeChange,
  requiredMilestoneId = "",
  milestoneConditions = [],
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
  onRequiredMilestoneChange,
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
    requiredMilestoneId,
  });
  const initialSignature = useRef(currentSignature);
  const hasUnsavedChanges =
    currentSignature !== initialSignature.current && saveStatus !== "saved";

  useEffect(() => {
    if (saveStatus === "saved") initialSignature.current = currentSignature;
  }, [currentSignature, saveStatus]);
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
  const isPanel = mode === "edit" && presentation === "panel";
  const isAdviserMilestone = milestoneType === "ADVISER_SELECTION";
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const nextTarget = portalTargetId
      ? document.getElementById(portalTargetId)
      : null;
    if (portalTarget !== nextTarget) setPortalTarget(nextTarget);
  });

  const composer = (
    <div
      className={
        isCreate
          ? "fixed inset-0 z-[70] flex flex-col bg-[var(--color-background)]"
          : isPanel
            ? "flex min-h-[640px] flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card-soft)] lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]"
            : "pointer-events-none fixed inset-y-0 right-0 z-[70] flex w-full max-w-[430px] flex-col pt-14"
      }
      role={isPanel ? "region" : "dialog"}
      aria-modal={isPanel ? undefined : true}
      aria-labelledby="milestone-composer-title"
    >
      <form
        onSubmit={onSubmit}
        className={`flex min-h-0 flex-1 flex-col ${
          isCreate
            ? ""
            : isPanel
              ? "overflow-hidden rounded-2xl bg-[var(--color-surface)]"
              : "pointer-events-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-xs sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              aria-label="Close milestone composer"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] disabled:opacity-50"
            >
              <i className="ti ti-x text-xl" />
            </button>
            <div className="min-w-0">
              <h2
                id="milestone-composer-title"
                className="truncate text-lg font-extrabold text-[var(--color-text-primary)] sm:text-xl"
              >
                {isCreate ? "New milestone" : "Milestone details"}
              </h2>
              {isCreate && <p className="truncate text-sm text-[var(--color-text-secondary)]">{workflowName || "Research workflow"}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saveStatus === "saved" && (
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400" role="status">
                <i className="ti ti-circle-check-filled mr-1" />
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-sm font-bold text-red-600 dark:text-red-400" role="alert">
                <i className="ti ti-alert-circle-filled mr-1" />
                Not saved
              </span>
            )}
            {isCreate && <button
              type="submit"
              disabled={saving || title.trim().length < 3 || !topicId}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-extrabold text-[var(--college-on-primary)] shadow-sm transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 dark:text-[var(--college-on-primary-dark)]"
            >
              {saving ? "Saving…" : isCreate ? "Add milestone" : "Save changes"}
            </button>}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={`mx-auto grid w-full gap-4 p-4 sm:p-5 ${isCreate ? "max-w-[1180px] lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-6 lg:p-8" : "max-w-none"}`}>
            <main className="space-y-5">
              <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
                <label
                  htmlFor="milestone-title"
                  className="block text-sm font-extrabold text-[var(--color-text-primary)]"
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
                  className="mt-2 w-full border-0 border-b-2 border-[var(--color-border)] bg-transparent px-0 py-3 text-lg font-bold text-[var(--color-text-primary)] outline-none transition placeholder:font-normal placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)]"
                />
                <label
                  htmlFor="milestone-instructions"
                  className="mt-6 block text-sm font-extrabold text-[var(--color-text-primary)]"
                >
                  Instructions{" "}
                  <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <textarea
                  id="milestone-instructions"
                  rows={8}
                  maxLength={4000}
                  value={instructions}
                  onChange={(event) => onInstructionsChange(event.target.value)}
                  placeholder="Explain what researchers need to complete and what a successful submission should contain."
                  className="mt-2 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-base leading-6 text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
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

              <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-[var(--color-text-primary)]">
                      Submission requirements
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
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
                      <span className="h-6 w-11 rounded-full bg-[var(--color-border-strong)] transition peer-checked:bg-[var(--color-primary)] after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
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
                  <div className="mt-4 rounded-xl bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
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
                  className="rounded-xl border border-rose-300 bg-[var(--color-surface)] px-4 py-2.5 text-sm font-extrabold text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                >
                  <i className="ti ti-trash mr-1.5" />
                  Remove milestone
                </button>
              )}
            </main>

            <aside className={`h-fit space-y-4 ${isCreate ? "lg:sticky lg:top-6" : ""}`}>
              <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <h3 className="font-extrabold text-[var(--color-text-primary)]">
                  Milestone settings
                </h3>
                <div className="mt-5 space-y-5">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Workflow
                    </span>
                    <p className="mt-1.5 text-base font-bold text-[var(--color-text-primary)]">
                      {workflowName || "Not selected"}
                    </p>
                  </div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)]">
                    Topic <span className="text-rose-600">*</span>
                    <select
                      value={topicId}
                      onChange={(event) => onTopicIdChange(event.target.value)}
                      required
                      className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-base font-normal text-[var(--color-text-primary)]"
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
                      <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                        Completed by
                      </span>
                      <div className="mt-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2.5 text-base text-[var(--color-text-secondary)]">
                        Research group · official adviser acceptance
                      </div>
                    </div>
                  ) : (
                    <label className="block text-sm font-bold text-[var(--color-text-primary)]">
                      Completed by
                      <select
                        value={submissionMode}
                        onChange={(event) =>
                          onSubmissionModeChange(event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-base font-normal text-[var(--color-text-primary)]"
                      >
                        <option value="GROUP">Research group</option>
                        <option value="INDIVIDUAL">
                          Individual researcher
                        </option>
                        <option value="EITHER">Individual or group</option>
                      </select>
                    </label>
                  )}
                  <label className="block text-sm font-bold text-[var(--color-text-primary)]">
                    Required Milestone Condition
                    <select
                      value={requiredMilestoneId}
                      onChange={(event) =>
                        onRequiredMilestoneChange(event.target.value)
                      }
                      aria-describedby="milestone-condition-help"
                      className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-base font-normal text-[var(--color-text-primary)]"
                    >
                      <option value="">No specific milestone required</option>
                      {milestoneConditions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span
                      id="milestone-condition-help"
                      className="mt-1.5 block text-xs font-normal leading-5 text-[var(--color-text-secondary)]"
                    >
                      The selected milestone must be completed and approved
                      first. An Adviser Milestone is satisfied when an eligible
                      adviser accepts. Only earlier milestones in this workflow
                      can be selected.
                    </span>
                  </label>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)]">
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
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-base font-normal text-[var(--color-text-primary)]"
                      />
                    </div>
                    <span
                      id="milestone-target-help"
                      className="mt-1 block text-xs font-normal leading-5 text-[var(--color-text-muted)]"
                    >
                      {legacyDeadlineDays != null
                        ? `Current target: ${legacyDeadlineDays} days after availability. Choose a date to replace it.`
                        : "Optional. Due by the end of this date (Philippine time)."}
                    </span>
                    {(targetCompletionDate || legacyDeadlineDays != null) && (
                      <button
                        type="button"
                        onClick={() => onTargetCompletionDateChange("")}
                        className="mt-1 text-xs font-semibold text-[var(--color-primary)] underline"
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
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                      <input
                        type="checkbox"
                        checked={requiresApproval}
                        disabled={milestoneType === "DEFENSE_ELIGIBILITY"}
                        onChange={(event) =>
                          onRequiresApprovalChange(event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                      />
                      <span>
                        <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                          Approval required
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-secondary)]">
                          Researchers cannot continue until this milestone is
                          approved.
                        </span>
                      </span>
                    </label>
                  )}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                    <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                      Workflow order
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
                        : milestoneType === "DEFENSE_ELIGIBILITY"
                          ? "Approve required submissions first, then grant the group's eligibility in Defense → Defense eligibility approvals."
                          : requiresApproval
                            ? `${reviewerLabel} must approve every required submission before the next milestone unlocks.`
                            : "Required submissions must be completed before the next milestone unlocks; no separate faculty approval gate is added."}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <button
                  type="button"
                  onClick={() => onAdvancedOpenChange(!advancedOpen)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span>
                    <span className="block font-extrabold text-[var(--color-text-primary)]">
                      Advanced settings
                    </span>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      Most milestones use the default type.
                    </span>
                  </span>
                  <i
                    className={`ti ${advancedOpen ? "ti-chevron-up" : "ti-chevron-down"}`}
                  />
                </button>
                {advancedOpen &&
                  (isAdviserMilestone ? (
                    <div className="mt-4 rounded-xl bg-[var(--color-surface-subtle)] px-3 py-2.5 text-sm font-bold text-[var(--color-text-primary)]">
                      Adviser Milestone
                    </div>
                  ) : (
                    <label className="mt-4 block text-sm font-bold text-[var(--color-text-primary)]">
                      Milestone type
                      <select
                        value={
                          milestoneType === "DEFENSE_ELIGIBILITY"
                            ? "DEFENSE_ELIGIBILITY"
                            : category
                        }
                        onChange={(event) => {
                          const defenseGate =
                            event.target.value === "DEFENSE_ELIGIBILITY";
                          onMilestoneTypeChange?.(
                            defenseGate ? "DEFENSE_ELIGIBILITY" : "STANDARD",
                          );
                          onCategoryChange(
                            defenseGate ? "Milestone" : event.target.value,
                          );
                          if (defenseGate) onRequiresApprovalChange(true);
                        }}
                        className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-base font-normal text-[var(--color-text-primary)]"
                      >
                        <option value="Milestone">Standard milestone</option>
                        <option value="DEFENSE_ELIGIBILITY">
                          Defense Eligibility
                        </option>
                        <option value="Compliance">
                          Compliance requirement
                        </option>
                        <option value="Pre-requisite">
                          Approval checkpoint
                        </option>
                      </select>
                      {milestoneType === "DEFENSE_ELIGIBILITY" && (
                        <span className="mt-2 block text-xs font-normal leading-5 text-[var(--color-text-secondary)]">
                          Coordinator approval grants one defense cycle. Passing
                          that defense consumes the eligibility; another
                          milestone approval is needed for the next defense.
                        </span>
                      )}
                    </label>
                  ))}
              </section>
            </aside>
          </div>
        </div>
        {!isCreate && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <button type="button" onClick={requestClose} disabled={saving} className="min-h-10 rounded-xl border border-[var(--color-border)] px-5 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || title.trim().length < 3 || !topicId} className="min-h-10 rounded-xl bg-[var(--color-primary)] px-6 text-sm font-extrabold text-[var(--college-on-primary)] shadow-sm hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[var(--college-on-primary-dark)]">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </footer>
        )}
      </form>
    </div>
  );

  if (portalTarget) return createPortal(composer, portalTarget);
  return portalTargetId ? null : composer;
}
