import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui/Modal";
import type { MilestonePosition } from "@/lib/workflow-order";

type Milestone = MilestonePosition & { title: string };
type Props = {
  milestone: Milestone;
  stages: Milestone[];
  topics: { id: string; title: string }[];
  busy: boolean;
  onMove: (topicId: string | null, beforeId: string | null) => Promise<boolean>;
  onEdit: () => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
};

export function WorkflowMilestoneActions({
  milestone,
  stages,
  topics,
  busy,
  onMove,
  onEdit,
  onDragStart,
  onDragEnd,
}: Props) {
  const [open, setOpen] = useState(false);
  const [topicId, setTopicId] = useState(milestone.topicId || "");
  const [beforeId, setBeforeId] = useState("");
  const siblings = stages.filter(
    (stage) => stage.topicId === milestone.topicId,
  );
  const index = siblings.findIndex((stage) => stage.id === milestone.id);
  const buttonClass =
    "grid h-9 w-9 place-items-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <>
      <div
        className="workflow-milestone-actions flex shrink-0 items-center gap-0.5"
        aria-label={`Arrange ${milestone.title}`}
      >
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          aria-label={`Arrange milestone ${milestone.title}`}
          title="Move or edit milestone"
          onClick={() => {
            setTopicId(milestone.topicId || "");
            setBeforeId(siblings[index + 1]?.id || "");
            setOpen(true);
          }}
        >
          <i className="ti ti-dots text-lg" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${buttonClass} cursor-grab active:cursor-grabbing`}
          disabled={busy}
          draggable={!busy}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={() => {
            setTopicId(milestone.topicId || "");
            setBeforeId(siblings[index + 1]?.id || "");
            setOpen(true);
          }}
          aria-label={`Drag or move ${milestone.title}`}
          title="Drag to another position or phase"
        >
          <i className="ti ti-grip-vertical text-lg" aria-hidden="true" />
        </button>
      </div>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <Modal
            isOpen={open}
            onClose={() => {
              if (!busy) setOpen(false);
            }}
            title="Move milestone"
            subtitle={milestone.title}
          >
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                The required milestone will follow the new order. Existing
                submissions and approvals are retained.
              </p>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Quick move within the current phase"
              >
                <button
                  type="button"
                  disabled={busy || index <= 0}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] disabled:opacity-30"
                  onClick={async () => {
                    if (await onMove(milestone.topicId, siblings[index - 1].id))
                      setOpen(false);
                  }}
                >
                  <i className="ti ti-arrow-up" aria-hidden="true" />
                  Move up
                </button>
                <button
                  type="button"
                  disabled={busy || index < 0 || index === siblings.length - 1}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] disabled:opacity-30"
                  onClick={async () => {
                    if (
                      await onMove(
                        milestone.topicId,
                        siblings[index + 2]?.id || null,
                      )
                    )
                      setOpen(false);
                  }}
                >
                  <i className="ti ti-arrow-down" aria-hidden="true" />
                  Move down
                </button>
              </div>
              <label className="block text-sm font-semibold">
                Destination phase
                <select
                  className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  value={topicId}
                  disabled={busy}
                  onChange={(event) => {
                    setTopicId(event.target.value);
                    setBeforeId("");
                  }}
                >
                  {!milestone.topicId && (
                    <option value="">Needs organization</option>
                  )}
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Position
                <select
                  className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  value={beforeId}
                  disabled={busy}
                  onChange={(event) => setBeforeId(event.target.value)}
                >
                  {stages
                    .filter(
                      (stage) =>
                        stage.id !== milestone.id &&
                        stage.topicId === (topicId || null),
                    )
                    .map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        Before {stage.title}
                      </option>
                    ))}
                  <option value="">End of phase</option>
                </select>
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-bold"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    onEdit();
                  }}
                >
                  Edit details
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-bold"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-[var(--college-on-primary)] disabled:opacity-50"
                  disabled={busy}
                  onClick={async () => {
                    if (await onMove(topicId || null, beforeId || null))
                      setOpen(false);
                  }}
                >
                  {busy ? "Saving…" : "Save position"}
                </button>
              </div>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
