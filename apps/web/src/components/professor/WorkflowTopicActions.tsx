import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui/Modal";

type Props = {
  title: string;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
};

export function WorkflowTopicActions({
  title,
  busy,
  canMoveUp,
  canMoveDown,
  canDelete,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const actionClass =
    "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-35";
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        aria-label={`More options for ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Topic options"
        className="grid h-9 w-9 place-items-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] disabled:opacity-30"
      >
        <i className="ti ti-dots text-lg" aria-hidden="true" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <Modal
            isOpen={open}
            title="Topic options"
            subtitle={title}
            onClose={() => {
              if (!busy) setOpen(false);
            }}
          >
            <div className="space-y-1">
              <button
                type="button"
                className={actionClass}
                disabled={busy || !canMoveUp}
                onClick={async () => {
                  await onMoveUp();
                  setOpen(false);
                }}
              >
                <i className="ti ti-arrow-up text-lg" aria-hidden="true" />
                Move topic up
              </button>
              <button
                type="button"
                className={actionClass}
                disabled={busy || !canMoveDown}
                onClick={async () => {
                  await onMoveDown();
                  setOpen(false);
                }}
              >
                <i className="ti ti-arrow-down text-lg" aria-hidden="true" />
                Move topic down
              </button>
              <button
                type="button"
                className={actionClass}
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                <i className="ti ti-pencil text-lg" aria-hidden="true" />
                Edit topic
              </button>
              <div className="mt-2 border-t border-[var(--color-border-subtle)] pt-2">
                <button
                  type="button"
                  className={`${actionClass} text-[var(--color-danger)]`}
                  disabled={busy || !canDelete}
                  title={
                    canDelete
                      ? "Delete topic"
                      : "Move the topic's milestones before deleting it"
                  }
                  onClick={async () => {
                    await onDelete();
                    setOpen(false);
                  }}
                >
                  <i className="ti ti-trash text-lg" aria-hidden="true" />
                  Delete topic
                </button>
                {!canDelete && (
                  <p className="px-3 pb-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                    Move this topic’s milestones before deleting it.
                  </p>
                )}
              </div>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
