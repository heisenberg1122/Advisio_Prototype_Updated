function withSearch(pathname: string, params: URLSearchParams) {
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function legacyStudentSubmissionsDestination(search = "") {
  const params = new URLSearchParams(search);
  const hasExactDocumentContext =
    params.has("documentId") || params.has("versionId");
  return withSearch(
    hasExactDocumentContext ? "/student/documents" : "/student/tasks",
    params,
  );
}

export function legacyProfessorMilestonesDestination(search = "") {
  return legacyPortalDashboardDestination("professor", "builder", search);
}

export function legacyPortalDashboardDestination(
  portal: "adviser" | "professor",
  tab: string,
  search = "",
) {
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  return withSearch(`/${portal}/dashboard`, params);
}
