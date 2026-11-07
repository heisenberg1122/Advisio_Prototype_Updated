export type EvaluationSession = {
  role: string;
  roleLabel: string;
  course: string;
  courseLabel: string;
  college: string;
  collegeCode?: string;
  progressKey?: string;
  roles?: { id: string; label: string }[];
  scenario?: string | null;
  scenarioLabel?: string | null;
  scenarios?: { id: string; label: string }[];
  signingPassword?: string;
  revisionAvailable?: boolean;
  title: string;
  home: string;
  projectId: string | null;
  defenseId: string | null;
  tasks: string[];
  revisionName: string;
  requestLetterAvailable?: boolean;
  expiresAt: string;
};

export type EvaluationConfig = {
  roles: { id: string; label: string; tasks: string[] }[];
  courses: {
    id: string;
    label: string;
    college: string;
    collegeCode?: string;
  }[];
  colleges?: EvaluationConfig["courses"];
  entryUrl: string;
  invitationUrl?: string;
  localOnly: boolean;
  temporaryStorage: boolean;
};

export async function evaluationRequest<T>(
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(`/api/evaluation/${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => {
    throw new Error(
      "The evaluation is temporarily unavailable. Try again or email advisio.main@gmail.com for help.",
    );
  });
  if (!response.ok)
    throw new Error(data.error || "Unable to connect to the evaluation.");
  return data as T;
}

export function clearEvaluation(
  projectId?: string,
  invitation?: { role?: string; course?: string },
) {
  localStorage.removeItem("advisio_token");
  if (projectId)
    localStorage.removeItem(`advisio_evaluation_guide:${projectId}`);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("advisio_evaluation_guide:"))
      localStorage.removeItem(key);
  }
  for (const key of [
    "advisio_theme:active",
    "advisio_color-theme:active",
    "advisio_college-theme:active",
  ])
    localStorage.removeItem(key);
  const entry = new URL("/evaluate", window.location.origin);
  if (invitation?.role) entry.searchParams.set("role", invitation.role);
  if (invitation?.course) entry.searchParams.set("course", invitation.course);
  window.location.assign(entry.pathname + entry.search);
}
