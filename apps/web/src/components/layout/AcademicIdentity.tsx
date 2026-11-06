"use client";

import { useState } from "react";
import { getAcademicIdentity } from "@/lib/academic-identity";

export function AcademicIdentity(props: Parameters<typeof getAcademicIdentity>[0]) {
  const identity = getAcademicIdentity(props);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  if (!identity) return null;
  const fallback = failedLogo === identity.logoSrc;

  return (
    <div role="group" aria-label="College and program" className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-light)]/40 p-2.5">
      <img
        src={fallback ? "/school-logo.png" : identity.logoSrc}
        alt={fallback ? "University of the Assumption logo" : identity.logoAlt}
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 object-contain"
        onError={() => { if (!fallback) setFailedLogo(identity.logoSrc); }}
      />
      <div className="min-w-0 flex-1 break-words text-left">
        {identity.collegeName && <p className="text-xs font-semibold leading-4 text-[var(--color-text-primary)]">{identity.collegeName}</p>}
        {identity.programName && <p className="mt-0.5 text-xs leading-4 text-[var(--color-text-secondary)]">{identity.programName}</p>}
      </div>
    </div>
  );
}
