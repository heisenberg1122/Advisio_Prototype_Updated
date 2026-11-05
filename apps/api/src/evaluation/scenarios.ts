import type { EvaluationRole, Scenario } from "./catalog.js";

export type ScenarioChoice = {
  id: string;
  label: string;
  project: Scenario;
  destination?:
    | "defense"
    | "evaluation"
    | "results"
    | "reviews"
    | "signatures"
    | "inbox";
  studentIdentity?: boolean;
};
export const DEMO_SIGNING_PASSWORD = "Demo-Dean-Review-2026!";
export const ROLE_SCENARIOS: Record<EvaluationRole, readonly ScenarioChoice[]> =
  {
    student: [
      { id: "in-progress", label: "In progress", project: "B" },
      {
        id: "live-defense",
        label: "Live defense",
        project: "E",
        destination: "defense",
        studentIdentity: true,
      },
      {
        id: "completed-title",
        label: "Completed Title Defense",
        project: "D",
        destination: "defense",
        studentIdentity: true,
      },
      {
        id: "completed-final",
        label: "Completed Final Defense",
        project: "F",
        destination: "defense",
        studentIdentity: true,
      },
    ],
    professor: [
      { id: "overview", label: "All assigned projects", project: "A" },
      {
        id: "pending-review",
        label: "Pending manuscript review",
        project: "A",
        destination: "reviews",
      },
      {
        id: "live-defense",
        label: "Live defense",
        project: "E",
        destination: "defense",
      },
      {
        id: "completed-defense",
        label: "Completed defense / results",
        project: "D",
        destination: "defense",
      },
      {
        id: "pending-signature",
        label: "Pending Dean signature",
        project: "G",
        destination: "signatures",
      },
      {
        id: "signed-request",
        label: "Signed Dean request",
        project: "D",
        destination: "inbox",
      },
    ],
    adviser: [
      { id: "overview", label: "All assigned projects", project: "A" },
      {
        id: "pending-review",
        label: "Pending manuscript review",
        project: "A",
        destination: "reviews",
      },
      {
        id: "review-history",
        label: "Review history",
        project: "D",
        destination: "reviews",
      },
      {
        id: "live-defense",
        label: "Live defense project",
        project: "E",
        destination: "defense",
      },
      {
        id: "completed-defense",
        label: "Completed defense project",
        project: "F",
        destination: "defense",
      },
    ],
    panelist: [
      { id: "overview", label: "All assigned defenses", project: "C" },
      {
        id: "pending-review",
        label: "Pending manuscript reviews",
        project: "C",
        destination: "reviews",
      },
      {
        id: "live-defense",
        label: "Live defense / evaluate",
        project: "E",
        destination: "evaluation",
      },
      {
        id: "review-history",
        label: "Manuscript review history",
        project: "D",
        destination: "reviews",
      },
      {
        id: "completed-title",
        label: "Completed Title Defense / results",
        project: "D",
        destination: "results",
      },
      {
        id: "completed-final",
        label: "Completed Final Defense / results",
        project: "F",
        destination: "results",
      },
    ],
    dean: [
      { id: "overview", label: "College overview", project: "G" },
      {
        id: "pending-signature",
        label: "Pending signature request",
        project: "G",
        destination: "signatures",
      },
      {
        id: "signed-request",
        label: "Signed request / history",
        project: "D",
        destination: "signatures",
      },
      {
        id: "live-defense",
        label: "Live defense",
        project: "E",
        destination: "defense",
      },
      {
        id: "completed-defense",
        label: "Completed defense / results",
        project: "F",
        destination: "defense",
      },
    ],
  };

export function scenarioTasks(
  role: EvaluationRole,
  scenario: string,
  fallback: string[],
) {
  if (role === "student" && scenario === "live-defense")
    return [
      "Open your live defense record.",
      "Read the published manuscript.",
      "Inspect the defense schedule and panel assignment.",
      "Follow the current defense status.",
      "Check which results are still pending release.",
      "Inspect the current milestone and remaining requirements.",
    ];
  if (role === "student" && scenario.startsWith("completed-"))
    return [
      "Open the completed defense record.",
      "Inspect your issued defense badge.",
      "Read the released panel evaluations.",
      "Read the panel recommendations and shared manuscript feedback.",
      "Open the manuscript and its version history.",
      scenario === "completed-final"
        ? "Confirm that the final workflow is complete."
        : "Confirm that Title Defense is complete and UAREB Submission remains the current milestone.",
    ];
  if (role === "dean" && scenario.includes("signature"))
    return [
      "Open Signature requests in your Inbox.",
      "Select the pending Coordinator request.",
      "Open and review the attached fictional PDF.",
      "Use the demo signing password and saved fictional signature to confirm signing.",
      "Open the signed PDF and inspect the signer, date, and verification code.",
      "Switch to Coordinator to inspect the signed request in Inbox.",
    ];
  if (
    (role === "dean" || role === "professor") &&
    scenario === "signed-request"
  )
    return [
      "Open the signed request in Inbox.",
      "Read the original Coordinator request.",
      "Open the signed PDF.",
      "Inspect the Dean's name and signing date.",
      "Inspect the verification code and original version history.",
      "Confirm that the request is recorded as signed.",
    ];
  return fallback;
}
