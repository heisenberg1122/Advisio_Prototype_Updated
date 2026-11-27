import {
  loadOfflineSession,
  readOffline,
  writeOffline,
  listOffline,
  removeOffline,
  OFFLINE_ENABLED,
  type OfflineFile,
  type OfflineSession,
} from "./store";

export const OFFLINE_READ = "advisio:offline-read";
export const OFFLINE_SAVE_ERROR = "advisio:offline-save-error";
export const SESSION_REJECTED = "advisio:offline-session-rejected";
type SavedResponse = { data: unknown; projectId?: string; workflowId?: string };

// Cache only the reads used by the researcher home, requirements, and document viewer.
// Never use this cache for faculty portals, sign-in, inbox, or arbitrary third-party URLs.
export function offlineResponsePath(url: string, base: string): string | null {
  try {
    const origin = new URL(base || "http://localhost");
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin.origin) return null;
    const path = parsed.pathname;
    const allowed =
      [
        "/api/research",
        "/api/workflows/enrollments/me",
        "/api/workflows/access/me",
        "/api/workspaces/me",
        "/api/consultations",
        "/api/notifications",
        "/api/defense-management",
        "/api/adviser-requests",
      ].includes(path) ||
      /^\/api\/research\/[^/]+\/(documents|manuscript-workflow|official-copies|defense-result|join-requests)$/.test(
        path,
      ) ||
      /^\/api\/workflows\/[^/]+\/resources$/.test(path) ||
      /^\/api\/workflows\/tasks\/[^/]+\/submission-options$/.test(path) ||
      /^\/api\/workflows\/tasks\/submissions\/[^/]+\/(comments|grade|history)$/.test(
        path,
      );
    if (!allowed) return null;
    parsed.searchParams.sort();
    return path + parsed.search;
  } catch {
    return null;
  }
}

export async function currentOfflineSession() {
  if (
    typeof window === "undefined" ||
    !/^\/student(?:\/|$)/.test(window.location?.pathname || "") ||
    typeof localStorage === "undefined" ||
    localStorage.getItem(OFFLINE_ENABLED) !== "1"
  )
    return null;
  return loadOfflineSession(localStorage.getItem("advisio_token")).catch(
    () => null,
  );
}

export async function cachedResponse<T>(session: OfflineSession, path: string) {
  const record = await readOffline<SavedResponse>(session, `response:${path}`);
  if (!record) return undefined;
  window.dispatchEvent(
    new CustomEvent(OFFLINE_READ, {
      detail: { savedAt: record.savedAt, path },
    }),
  );
  return record.value.data as T;
}

export async function saveResponse(
  session: OfflineSession,
  path: string,
  data: any,
) {
  let projectId = path.match(/^\/api\/research\/([^/?]+)\//)?.[1];
  const workflowId = path.match(/^\/api\/workflows\/([^/?]+)\/resources/)?.[1];
  const submissionId = path.match(
    /^\/api\/workflows\/tasks\/submissions\/([^/?]+)\//,
  )?.[1];
  if (submissionId || path.includes("/submission-options")) {
    const research = await readOffline<SavedResponse>(
      session,
      "response:/api/research",
    );
    const projects = (research?.value.data as any)?.projects || [];
    projectId = submissionId
      ? projects.find((project: any) =>
          project.taskSubmissions?.some(
            (submission: any) => submission.id === submissionId,
          ),
        )?.id
      : projects.find(
          (project: any) =>
            project.id ===
            new URL(path, "http://localhost").searchParams.get("researchId"),
        )?.id;
    if (!projectId) return;
  }
  await writeOffline<SavedResponse>(session, `response:${path}`, {
    data,
    projectId,
    workflowId,
  });
  if (path === "/api/research") {
    const projects = new Set(
      (data.projects || []).map((project: any) => project.id),
    );
    for (const record of await listOffline<SavedResponse>(
      session,
      "response:",
    )) {
      if (record.value.projectId && !projects.has(record.value.projectId))
        await removeOffline(session, record.key);
    }
    for (const file of await listOffline<OfflineFile>(session, "file:")) {
      if (file.value.projectId && !projects.has(file.value.projectId))
        await removeOffline(session, file.key);
    }
  }
  if (path === "/api/workflows/enrollments/me") {
    const workflows = new Set(
      (data.enrollments || []).map((entry: any) => entry.workflowId),
    );
    for (const record of await listOffline<SavedResponse>(
      session,
      "response:",
    )) {
      if (record.value.workflowId && !workflows.has(record.value.workflowId))
        await removeOffline(session, record.key);
    }
    for (const file of await listOffline<OfflineFile>(session, "file:")) {
      if (file.value.workflowId && !workflows.has(file.value.workflowId))
        await removeOffline(session, file.key);
    }
  }
  if (projectId && path.endsWith("/documents")) {
    const versions = new Set(
      (data.documents || []).flatMap((document: any) =>
        (document.versions || []).map(
          (version: any) => `file:document:${version.id}`,
        ),
      ),
    );
    for (const file of await listOffline<OfflineFile>(session, "file:")) {
      if (file.value.projectId === projectId && !versions.has(file.key))
        await removeOffline(session, file.key);
    }
  }
  if (workflowId) {
    const resources = new Set(
      (data.resources || []).map(
        (resource: any) => `file:resource:${resource.id}:${resource.version}`,
      ),
    );
    for (const file of await listOffline<OfflineFile>(session, "file:")) {
      if (file.value.workflowId === workflowId && !resources.has(file.key))
        await removeOffline(session, file.key);
    }
  }
}

export async function evictResponse(session: OfflineSession, path: string) {
  await removeOffline(session, `response:${path}`);
  const projectId = path.match(/^\/api\/research\/([^/?]+)\//)?.[1];
  const workflowId = path.match(/^\/api\/workflows\/([^/?]+)\/resources/)?.[1];
  for (const record of await listOffline<SavedResponse>(session, "response:")) {
    if (
      (projectId && record.value.projectId === projectId) ||
      (workflowId && record.value.workflowId === workflowId)
    )
      await removeOffline(session, record.key);
  }
  for (const file of await listOffline<OfflineFile>(session, "file:")) {
    if (
      (projectId && file.value.projectId === projectId) ||
      (workflowId && file.value.workflowId === workflowId)
    )
      await removeOffline(session, file.key);
  }
}

export async function cachedFile(
  session: OfflineSession,
  url: string,
  base: string,
) {
  const parsed = new URL(url, base || window.location.origin);
  const origin = new URL(base || window.location.origin);
  if (parsed.origin !== origin.origin) return null;
  const version = parsed.pathname.match(
    /^\/api\/documents\/versions\/([^/]+)\/content$/,
  )?.[1];
  const files = await listOffline<OfflineFile>(session, "file:");
  const stored = files.find((file) =>
    version
      ? file.key === `file:document:${version}`
      : file.value.url &&
        new URL(file.value.url, origin).pathname === parsed.pathname,
  );
  return stored?.value.blob || null;
}
