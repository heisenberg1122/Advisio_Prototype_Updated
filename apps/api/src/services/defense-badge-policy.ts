export function defenseBadgeKind(defenseType?: string | null) {
  if (defenseType === "TITLE_DEFENSE") return "TITLE_DEFENSE";
  if (["FINAL_DEFENSE", "FINAL_ORAL_DEFENSE"].includes(defenseType || ""))
    return "FINAL_DEFENSE";
  return null;
}

export function canIssueDefenseBadge(session: {
  status: string;
  decision: string | null;
  releasedAt: Date | null;
  revisionClearance?: unknown;
  defenseEvent: { defenseType: string } | null;
}) {
  return (
    session.status === "COMPLETED" &&
    (session.decision === "APPROVED" ||
      (Boolean(session.revisionClearance) &&
        ["APPROVED_WITH_MINOR_REVISIONS", "MAJOR_REVISIONS_REQUIRED"].includes(
          session.decision || "",
        ))) &&
    Boolean(session.releasedAt) &&
    Boolean(defenseBadgeKind(session.defenseEvent?.defenseType))
  );
}
