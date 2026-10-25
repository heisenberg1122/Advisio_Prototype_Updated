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
  defenseEvent: { defenseType: string } | null;
}) {
  return (
    session.status === "COMPLETED" &&
    session.decision === "APPROVED" &&
    Boolean(session.releasedAt) &&
    Boolean(defenseBadgeKind(session.defenseEvent?.defenseType))
  );
}
