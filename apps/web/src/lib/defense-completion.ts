export type CompletionSession = {
  id: string;
  researchId: string;
  createdAt: string;
  status: string;
  decision?: string | null;
  releasedAt?: string | null;
  releasedFeedback?: string | null;
  revisionClearance?: unknown;
  defenseEvent?: { defenseType: string } | null;
  badge?: { recipients?: { userId: string }[]; _count?: { certificates: number } } | null;
};

export function latestFinalDefense(sessions: CompletionSession[], projectId: string) {
  return sessions.filter((session) => session.researchId === projectId &&
    session.status !== "CANCELLED" && ["FINAL_DEFENSE", "FINAL_ORAL_DEFENSE"].includes(session.defenseEvent?.defenseType ?? ""))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))[0];
}

export function defenseCompletion(session?: CompletionSession) {
  if (!session) return { label: "Final Defense not scheduled", owner: "Research Coordinator" };
  if (!session.releasedAt) {
    if (session.status === "PENDING_ACKNOWLEDGEMENT") return { label: "Waiting for panel replies", owner: "Panel members" };
    if (session.status === "NEEDS_RESCHEDULING") return { label: "Defense needs rescheduling", owner: "Research Coordinator" };
    if (session.status === "SCHEDULED") return { label: "Final Defense scheduled", owner: "Research group and panel" };
    return { label: "Official result pending", owner: "Defense facilitator" };
  }
  if (session.decision === "REJECTED") return { label: "Final Defense result released · Rejected", owner: "Research group and coordinator" };
  if (session.decision === "REDEFENSE_REQUIRED") return { label: "Re-defense required", owner: "Research group and coordinator" };
  if (["APPROVED_WITH_MINOR_REVISIONS", "MAJOR_REVISIONS_REQUIRED"].includes(session.decision ?? "") && !session.revisionClearance) {
    return { label: "Revisions required", owner: "Research group submits revisions for clearance" };
  }
  if ((session.badge?._count?.certificates ?? 0) > 0) return { label: "Certificates issued", owner: null };
  return {
    label: session.revisionClearance ? "Revisions cleared · Certificate pending" : "Result released · Certificate pending",
    owner: "Research Coordinator",
  };
}
