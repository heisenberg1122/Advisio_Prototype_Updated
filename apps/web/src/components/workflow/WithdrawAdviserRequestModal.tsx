import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

interface WithdrawAdviserRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  adviserName: string;
  isSubmitting?: boolean;
}

export function WithdrawAdviserRequestModal({
  isOpen,
  onClose,
  onConfirm,
  adviserName,
  isSubmitting = false,
}: WithdrawAdviserRequestModalProps) {
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(reason.trim() || undefined);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Withdraw Adviser Request"
      subtitle="Cancel your group's pending invitation to this faculty member"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] transition cursor-pointer disabled:opacity-50"
          >
            Keep Request
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <i className="ti ti-loader-2 animate-spin text-sm" />
                Withdrawing…
              </>
            ) : (
              <>
                <i className="ti ti-arrow-back-up text-sm" />
                Confirm Withdrawal
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <i className="ti ti-alert-triangle text-base text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Important</strong>
              <span>
                Withdrawing this request will immediately cancel the pending
                invitation to <strong>{adviserName}</strong>. Your research
                group will be able to select another eligible adviser from the
                Adviser Pool.
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
            Reason for withdrawal{" "}
            <span className="font-normal lowercase text-[var(--color-text-muted)]">
              (optional)
            </span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g., Selecting another adviser with closer alignment to our topic."
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)] resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
