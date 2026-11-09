"use client";

import { ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { useIsPhone } from "@/hooks/use-is-phone";
import { Modal } from "./Modal";

export interface PhoneFiltersProps {
  children: ReactNode;
  title?: string;
  label?: string;
  /** Guided-tour anchor for the phone button, when the fields themselves are hidden. */
  guide?: string;
  /** Number of filters currently narrowing the results. */
  activeCount?: number;
  onClear?: () => void;
  /** Runs when the sheet is confirmed, for filters that only apply on submit. */
  onApply?: () => void;
}

/**
 * Renders its children unchanged above phone width. On phones they move into a
 * bottom sheet behind a single Filters button, with state still owned by the page.
 */
export function PhoneFilters({ children, title = "Filters", label = "Filters", guide, activeCount = 0, onClear, onApply }: PhoneFiltersProps) {
  const isPhone = useIsPhone();
  const [isOpen, setIsOpen] = useState(false);
  if (!isPhone) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        className="phone-filter-button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        data-guide={guide}
        onClick={() => setIsOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        {label}
        {activeCount > 0 && <span className="phone-filter-count">{activeCount}</span>}
      </button>
      {createPortal(
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={title}
          footer={
            <div className="phone-filter-actions">
              {onClear && (
                <button type="button" className="phone-filter-clear" onClick={onClear}>
                  Clear
                </button>
              )}
              <button
                type="button"
                className="phone-filter-apply"
                onClick={() => {
                  onApply?.();
                  setIsOpen(false);
                }}
              >
                Show results
              </button>
            </div>
          }
        >
          <div className="phone-filter-fields">{children}</div>
        </Modal>,
        document.body,
      )}
    </>
  );
}

export default PhoneFilters;
