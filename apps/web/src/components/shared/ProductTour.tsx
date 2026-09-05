import React, { useState, useEffect, useCallback } from "react";

export interface TourStep {
  selector?: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

interface ProductTourProps {
  tourKey: string; // e.g. "student-dashboard-tour"
  steps: TourStep[];
  isOpen?: boolean;
  onClose?: () => void;
  autoStart?: boolean;
}

export const ProductTour: React.FC<ProductTourProps> = ({
  tourKey,
  steps,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  autoStart = true,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const isControlled = controlledIsOpen !== undefined;
  const active = isControlled ? controlledIsOpen : internalIsOpen;

  // Check if user has already completed this tour
  useEffect(() => {
    if (!isControlled && autoStart) {
      const seen = localStorage.getItem(`advisio_tour_${tourKey}`);
      if (!seen) {
        // Small delay so layout finishes rendering
        const timer = setTimeout(() => {
          setInternalIsOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [tourKey, autoStart, isControlled]);

  const handleClose = useCallback(() => {
    localStorage.setItem(`advisio_tour_${tourKey}`, "completed");
    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [tourKey, isControlled, controlledOnClose]);

  // Compute spotlight position
  useEffect(() => {
    if (!active) return;
    const step = steps[currentStepIndex];
    if (!step || !step.selector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const updateRect = () => {
        setTargetRect(el.getBoundingClientRect());
      };
      updateRect();
      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect);
      return () => {
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect);
      };
    } else {
      setTargetRect(null);
    }
  }, [active, currentStepIndex, steps]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowRight") {
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          handleClose();
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, currentStepIndex, steps.length, handleClose]);

  if (!active || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  const isLast = currentStepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto select-none">
      {/* Darkened backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Target spotlight glow */}
      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_24px_rgba(59,130,246,0.5)] transition-all duration-300 pointer-events-none"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Step Tooltip Card */}
      <div
        className="relative z-50 max-w-md w-full mx-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 transition-all duration-300 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
            title="Skip Tour (Esc)"
          >
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="py-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {currentStep.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentStep.content}
          </p>
        </div>

        {/* Progress dots and actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex space-x-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStepIndex
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center space-x-2">
            {currentStepIndex > 0 && (
              <button
                onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Back
              </button>
            )}

            <button
              onClick={() => {
                if (isLast) {
                  handleClose();
                } else {
                  setCurrentStepIndex((prev) => prev + 1);
                }
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              {isLast ? (
                <>Finish <i className="ti ti-check text-xs" /></>
              ) : (
                <>Next <i className="ti ti-chevron-right text-xs" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
