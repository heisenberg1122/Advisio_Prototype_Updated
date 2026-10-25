import { Tag } from "@/components/ui/Tag";

interface ProgressTrackerProps {
  status: "APPROVED" | "PENDING_ADVISER" | "DECLINED" | "NOT_STARTED" | string;
  adviserName?: string | null;
  requestedAt?: string | Date | null;
  acceptedAt?: string | Date | null;
  respondedAt?: string | Date | null;
  latestRequestStatus?:
    | "PENDING"
    | "ACCEPTED"
    | "REJECTED"
    | "CANCELLED"
    | string
    | null;
}

export function AdviserRequestProgressTracker({
  status,
  adviserName,
  requestedAt,
  acceptedAt,
  respondedAt,
  latestRequestStatus,
}: ProgressTrackerProps) {
  const isApproved = status === "APPROVED";
  const isPending = status === "PENDING_ADVISER";
  const isDeclined = status === "DECLINED";
  const isWithdrawn =
    !isApproved && !isPending && latestRequestStatus === "CANCELLED";

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  const steps = [
    {
      number: 1,
      title: "Adviser Selection",
      description:
        isApproved || isPending || isDeclined
          ? "Adviser chosen"
          : "Choose from pool",
      state: isApproved || isPending || isDeclined ? "completed" : "current",
      icon:
        isApproved || isPending || isDeclined ? "ti-check" : "ti-user-search",
    },
    {
      number: 2,
      title: "Request Submitted",
      description: requestedAt
        ? `Sent on ${formatDate(requestedAt)}`
        : isPending || isApproved
          ? "Invitation sent"
          : "Leader sends request",
      state:
        isApproved || isPending || isDeclined || isWithdrawn
          ? "completed"
          : "pending",
      icon:
        isApproved || isPending || isDeclined || isWithdrawn
          ? "ti-check"
          : "ti-send",
    },
    {
      number: 3,
      title: isDeclined
        ? "Request Declined"
        : isWithdrawn
          ? "Request Withdrawn"
          : "Adviser Acceptance",
      description: isApproved
        ? acceptedAt
          ? `Accepted ${formatDate(acceptedAt)}`
          : "Official acceptance"
        : isPending
          ? "Awaiting decision"
          : isDeclined
            ? respondedAt
              ? `Declined ${formatDate(respondedAt)}`
              : "Declined by faculty"
            : isWithdrawn
              ? "Withdrawn by leader"
              : "Faculty review",
      state: isApproved
        ? "completed"
        : isPending
          ? "current"
          : isDeclined
            ? "declined"
            : isWithdrawn
              ? "withdrawn"
              : "pending",
      icon: isApproved
        ? "ti-check"
        : isPending
          ? "ti-clock-hour-4"
          : isDeclined
            ? "ti-x"
            : isWithdrawn
              ? "ti-arrow-back-up"
              : "ti-user-check",
    },
    {
      number: 4,
      title: "Milestone Approved",
      description: isApproved ? "Verified & advanced" : "Unlocks next stage",
      state: isApproved ? "completed" : "pending",
      icon: isApproved ? "ti-rosette-discount-check" : "ti-lock",
    },
  ];

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Request Progress
        </h4>
        <Tag
          variant={
            isApproved
              ? "success"
              : isDeclined
                ? "warn"
                : isPending
                  ? "info"
                  : "neutral"
          }
        >
          {status.replace(/_/g, " ")}
        </Tag>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 relative">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isStepCompleted = step.state === "completed";
          const isStepCurrent = step.state === "current";
          const isStepDeclined = step.state === "declined";
          const isStepWithdrawn = step.state === "withdrawn";

          return (
            <div key={step.number} className="flex flex-col relative">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
                    isStepCompleted
                      ? "bg-emerald-600 text-white dark:bg-emerald-500 shadow-xs"
                      : isStepCurrent
                        ? "bg-[var(--color-primary)] text-white shadow-xs ring-4 ring-[var(--college-focus-ring)]"
                        : isStepDeclined
                          ? "bg-rose-600 text-white dark:bg-rose-500"
                          : isStepWithdrawn
                            ? "bg-amber-600 text-white dark:bg-amber-500"
                            : "bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-slate-400"
                  }`}
                  aria-label={`Step ${step.number}: ${step.title} (${step.state})`}
                >
                  <i className={`ti ${step.icon} text-base`} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Step {step.number}
                  </p>
                  <h5
                    className={`text-sm font-bold truncate leading-tight ${
                      isStepCompleted || isStepCurrent
                        ? "text-[var(--color-text-primary)]"
                        : isStepDeclined
                          ? "text-rose-700 dark:text-rose-400"
                          : isStepWithdrawn
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {step.title}
                  </h5>
                </div>
              </div>

              <p className="mt-2 text-xs text-[var(--color-text-secondary)] pl-12 sm:pl-0 sm:mt-2.5 line-clamp-1">
                {step.description}
              </p>

              {/* Step indicator bar on desktop */}
              <div
                className={`hidden lg:block mt-3 h-1.5 w-full rounded-full ${
                  isStepCompleted
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : isStepCurrent
                      ? "bg-[var(--color-primary)]"
                      : isStepDeclined
                        ? "bg-rose-500"
                        : isStepWithdrawn
                          ? "bg-amber-500"
                          : "bg-slate-100 dark:bg-white/10"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
