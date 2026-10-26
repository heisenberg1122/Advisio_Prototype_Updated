export function projectAdviserRequests<
  T extends { researchId: string; status: string },
>(requests: T[], projectId?: string | null) {
  const scoped = projectId
    ? requests.filter((request) => request.researchId === projectId)
    : [];
  return {
    requests: scoped,
    pendingRequest:
      scoped.find((request) => request.status === "PENDING") || null,
  };
}
