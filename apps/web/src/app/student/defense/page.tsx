"use client";

import { useDefense } from "@/hooks/use-student";
import { EligibilityBanner } from "@/components/defense/EligibilityBanner";
import { DefenseChecklist } from "@/components/defense/DefenseChecklist";
import { DefenseSkeleton } from "@/components/defense/DefenseSkeleton";

export default function DefensePage() {
  const { data, isPending } = useDefense();

  if (isPending) return <DefenseSkeleton />;
  if (!data) return null;

  const { requirements, eligibility } = data;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <EligibilityBanner eligibility={eligibility} />
      <DefenseChecklist requirements={requirements} />
    </div>
  );
}
