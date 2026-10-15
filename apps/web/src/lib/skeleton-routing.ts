export type ContentSkeletonKind =
  | "cards"
  | "calendar"
  | "dashboard"
  | "files"
  | "form"
  | "list"
  | "mail"
  | "notifications"
  | "profile"
  | "table";

export function contentSkeletonKindForPath(
  pathname: string,
): ContentSkeletonKind {
  const path = pathname.toLowerCase();

  if (
    path.includes("/profile/edit") ||
    path.includes("/settings") ||
    path.includes("/join") ||
    path.includes("onboarding")
  ) {
    return "form";
  }
  if (path.includes("/profile")) return "profile";
  if (path.includes("notification")) return "notifications";
  if (path.includes("calendar") || path.includes("schedule")) return "calendar";
  if (path.includes("inbox") || path.includes("mail")) return "mail";
  if (
    path.includes("document") ||
    path.includes("file") ||
    path.includes("submission") ||
    path.includes("signature")
  ) {
    return "files";
  }
  if (
    path.includes("dashboard") ||
    path === "/dashboard" ||
    path.includes("analytics")
  ) {
    return "dashboard";
  }
  if (
    path.includes("adviser-pool") ||
    path.includes("consultation") ||
    path.includes("defense") ||
    path.includes("/groups")
  ) {
    return "cards";
  }
  if (
    path.includes("task") ||
    path.includes("request") ||
    path.includes("review") ||
    path.includes("evaluation") ||
    path.includes("panelist") ||
    path.includes("rubric") ||
    path.includes("announcement") ||
    path.includes("grade")
  ) {
    return "table";
  }
  return "list";
}
