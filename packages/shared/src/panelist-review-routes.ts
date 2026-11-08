export const defensePacketsTab = "defense-packets";
const reviewsPath = "/panelist/reviews";

export const panelistReviewRoutes = {
  reviews: reviewsPath,
  packet: `${reviewsPath}?tab=${defensePacketsTab}`,
} as const;

export function panelistDefensePacketsHref({
  sessionId,
  review,
}: { sessionId?: string | null; review?: string | null } = {}) {
  const params = new URLSearchParams({ tab: defensePacketsTab });
  if (sessionId) params.set("sessionId", sessionId);
  if (review === "pending" || review === "history") params.set("review", review);
  return `${reviewsPath}?${params}`;
}
