import { AlertCircle, CheckCircle2, TriangleAlert } from "lucide-react";
import type {
  ActionFeedbackState,
  ActionFeedbackTone,
} from "../../hooks/use-async-action";
import { cn } from "../../lib/utils";

export interface ActionFeedbackProps {
  feedback?: ActionFeedbackState | null;
  tone?: ActionFeedbackTone;
  message?: string | null;
  className?: string;
  id?: string;
}

const toneStyles: Record<ActionFeedbackTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
};

export function ActionFeedback({
  feedback,
  tone,
  message,
  className,
  id,
}: ActionFeedbackProps) {
  const resolvedTone = feedback?.tone ?? tone;
  const resolvedMessage = feedback?.message ?? message;
  if (!resolvedTone || !resolvedMessage) return null;

  const Icon = icons[resolvedTone];
  const isError = resolvedTone === "error";

  return (
    <div
      id={id}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm font-medium motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150",
        toneStyles[resolvedTone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{resolvedMessage}</span>
    </div>
  );
}
