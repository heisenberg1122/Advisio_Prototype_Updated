export type ProjectOption = { id: string };

export type ProjectResolution<T extends ProjectOption> = {
  project: T | null;
  projectId: string | null;
  invalidRequestedProjectId: string | null;
  requiresSelection: boolean;
};

export function resolveActiveProject<T extends ProjectOption>(
  projects: T[],
  requestedProjectId?: string | null,
  storedProjectId?: string | null,
): ProjectResolution<T> {
  if (requestedProjectId) {
    const project = projects.find(({ id }) => id === requestedProjectId) || null;
    return {
      project,
      projectId: project?.id || null,
      invalidRequestedProjectId: project ? null : requestedProjectId,
      requiresSelection: false,
    };
  }

  if (storedProjectId) {
    const project = projects.find(({ id }) => id === storedProjectId) || null;
    if (project)
      return {
        project,
        projectId: project.id,
        invalidRequestedProjectId: null,
        requiresSelection: false,
      };
  }

  const project = projects.length === 1 ? projects[0] : null;
  return {
    project,
    projectId: project?.id || null,
    invalidRequestedProjectId: null,
    requiresSelection: projects.length > 1,
  };
}

export function withProjectContext(path: string, projectId?: string | null) {
  if (!projectId) return path;
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("projectId", projectId);
  return `${pathname}?${params.toString()}`;
}
