import React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export type ButtonActionStatus = "idle" | "pending" | "success" | "error";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "accent"
    | "gold"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  status?: ButtonActionStatus;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const ACTION_LABELS: Array<[RegExp, string]> = [
  [/\bsign[ -]?in\b|\blogin\b/i, "Signing in..."],
  [/\bsubmit\b/i, "Submitting..."],
  [/\bsave\b/i, "Saving..."],
  [/\bupload\b/i, "Uploading..."],
  [/\bsend\b/i, "Sending..."],
  [/\bapprove\b/i, "Approving..."],
  [/\breject\b/i, "Rejecting..."],
  [/\bdelete\b|\bremove\b/i, "Deleting..."],
  [/\bsign\b/i, "Signing..."],
  [/\bfinalize\b/i, "Finalizing..."],
  [/\bcreate\b|\bregister\b/i, "Creating..."],
  [/\bupdate\b/i, "Updating..."],
  [/\bverify\b/i, "Verifying..."],
  [/\bimport\b/i, "Importing..."],
  [/\bretry\b/i, "Retrying..."],
  [/\baccept\b/i, "Accepting..."],
  [/\bdecline\b/i, "Declining..."],
  [/\bwithdraw\b/i, "Withdrawing..."],
  [/\bjoin\b/i, "Joining..."],
];

function getTextContent(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getTextContent).join(" ");
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getTextContent(node.props.children);
  }
  return "";
}

export function getLoadingLabel(children: React.ReactNode): string {
  const label = getTextContent(children).trim();
  return (
    ACTION_LABELS.find(([pattern]) => pattern.test(label))?.[1] ?? "Working..."
  );
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:border-[var(--color-primary-dark)] focus:ring-[var(--college-focus-ring)] shadow-xs",
  accent:
    "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:border-[var(--color-primary-dark)] font-semibold focus:ring-[var(--college-focus-ring)] shadow-xs",
  gold: "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:border-[var(--color-primary-dark)] font-semibold focus:ring-[var(--college-focus-ring)] shadow-xs",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] focus:ring-[var(--college-focus-ring)] shadow-xs",
  outline:
    "bg-transparent text-[var(--color-primary)] border border-[var(--color-primary)]/30 dark:border-white/20 hover:bg-[var(--color-primary-light)] focus:ring-[var(--college-focus-ring)]",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--nav-hover-bg)] hover:text-[var(--color-primary)]",
  danger:
    "bg-[#C94A4A] text-white border border-[#C94A4A] hover:bg-[#b03d3d] focus:ring-[#C94A4A]/30 shadow-xs",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-9 px-3.5 py-2 text-sm rounded-xl gap-1.5 font-semibold",
  md: "min-h-10 px-4 py-2 text-sm rounded-xl gap-2 font-semibold",
  lg: "min-h-11 px-5 py-2.5 text-base rounded-xl gap-2.5 font-semibold",
  icon: "h-10 w-10 p-0 rounded-xl justify-center",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  status = "idle",
  loadingText,
  successText = "Completed",
  errorText,
  icon,
  iconRight,
  children,
  className,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const actionStatus = isLoading ? "pending" : status;
  const pending = actionStatus === "pending";
  const succeeded = actionStatus === "success";
  const failed = actionStatus === "error";
  const originalLabel = getTextContent(children).trim();
  const pendingLabel = loadingText ?? getLoadingLabel(children);
  const failedLabel = errorText ?? originalLabel;
  const activeLabel = pending
    ? pendingLabel
    : succeeded
      ? successText
      : failed
        ? failedLabel
        : originalLabel;

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending || succeeded}
      aria-busy={pending || undefined}
      data-action-status={actionStatus}
      className={cn(
        "inline-flex items-center justify-center font-medium select-none transition-all duration-150 ease-in-out cursor-pointer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
        "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98]",
        succeeded
          ? "bg-emerald-600 text-white border border-emerald-600 focus:ring-emerald-500/30 shadow-xs"
          : failed
            ? "bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 focus:ring-red-500/30 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700"
            : variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin shrink-0" />
      ) : succeeded ? (
        <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
      ) : failed ? (
        <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      ) : (
        icon && (
          <span aria-hidden="true" className="shrink-0">
            {icon}
          </span>
        )
      )}

      {children && size === "icon" && (
        <span aria-hidden="true" className="shrink-0">
          {children}
        </span>
      )}

      {children && size !== "icon" && (
        <span
          aria-hidden="true"
          className="grid min-w-0 place-items-center break-words"
        >
          <span
            className={cn(
              "[grid-area:1/1]",
              actionStatus !== "idle" && "invisible",
            )}
          >
            {children}
          </span>
          <span className={cn("[grid-area:1/1]", !pending && "invisible")}>
            {pendingLabel}
          </span>
          <span className={cn("[grid-area:1/1]", !succeeded && "invisible")}>
            {successText}
          </span>
          {failedLabel && (
            <span className={cn("[grid-area:1/1]", !failed && "invisible")}>
              {failedLabel}
            </span>
          )}
        </span>
      )}

      {activeLabel && <span className="sr-only">{activeLabel}</span>}

      {actionStatus === "idle" && iconRight && (
        <span aria-hidden="true" className="shrink-0">
          {iconRight}
        </span>
      )}
    </button>
  );
}
