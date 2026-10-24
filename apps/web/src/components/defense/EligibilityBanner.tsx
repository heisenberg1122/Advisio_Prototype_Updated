import { Card } from "@/components/ui/Card";
import type { DefenseEligibility } from "@/types/student";

interface EligibilityBannerProps {
  eligibility: DefenseEligibility;
}

export function EligibilityBanner({ eligibility }: EligibilityBannerProps) {
  const isEligible = eligibility === "eligible";

  return (
    <Card accentColor={isEligible ? "success" : "warning"} className="mb-4">
      {isEligible ? (
        <div className="text-[13px] font-medium text-[var(--color-text-success)]">
          <i className="ti ti-shield-check mr-1.5" aria-hidden="true" />
          Your group is eligible for defense scheduling
        </div>
      ) : (
        <>
          <div className="text-[13px] font-medium text-[var(--color-text-warning)] mb-2">
            <i className="ti ti-alert-triangle mr-1.5" aria-hidden="true" />
            Not yet eligible for defense
          </div>
          <p className="text-base text-[var(--color-text-secondary)]">
            Complete all requirements below to unlock defense scheduling.
          </p>
        </>
      )}
    </Card>
  );
}
