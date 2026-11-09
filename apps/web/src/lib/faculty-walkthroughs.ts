import {
  facultyHelp,
  type FacultyHelpWorkspace,
} from "@research-management/shared/src/faculty-help";
import {
  findGuideTarget,
  guideTargetNotice,
} from "@/components/guide/GuidedWalkthrough";
import type { GuidedJourney } from "@/components/guide/guided-walkthrough-types";

function samePage(href: string, destination: string) {
  const current = new URL(href, "https://advisio.local");
  const target = new URL(destination, "https://advisio.local");
  return (
    current.pathname === target.pathname &&
    current.searchParams.get("tab") === target.searchParams.get("tab")
  );
}

function allowedHelp(
  workspace: FacultyHelpWorkspace,
  permissions: readonly string[],
) {
  return facultyHelp[workspace].filter(
    (topic) => !topic.permission || permissions.includes(topic.permission),
  );
}

export function facultyPageHelp(
  workspace: FacultyHelpWorkspace,
  href: string,
  permissions: readonly string[],
) {
  return allowedHelp(workspace, permissions).find((topic) =>
    samePage(href, topic.href),
  )?.id;
}

export function buildFacultyJourney(
  workspace: FacultyHelpWorkspace,
  id: string,
  href: string,
  permissions: readonly string[],
): GuidedJourney | null {
  const topics = allowedHelp(workspace, permissions);
  const topic =
    id === "introduction"
      ? (topics.find((item) => samePage(href, item.href)) ?? topics[0])
      : topics.find((item) => item.id === id);
  if (!topic) return null;
  return {
    id,
    title: topic.question,
    steps: topic.controls.map((control) => ({
      id: control.key,
      title: topic.question,
      text: control.text,
      targets: [
        {
          key: control.key,
          interaction: control.interaction ?? "read",
          emptyText: control.state?.empty,
          disabledText: control.state?.disabled,
        },
      ],
      route: topic.href,
      fallback: topic.fallback,
    })),
  };
}

export function facultyStateNotice(
  workspace: FacultyHelpWorkspace,
  topicId: string,
  href: string,
  permissions: readonly string[],
) {
  const topic = allowedHelp(workspace, permissions).find(
    (item) => item.id === topicId,
  );
  if (!topic || !samePage(href, topic.href)) return;
  for (const { key, state } of topic.controls) {
    if (!state) continue;
    const node = findGuideTarget(key);
    if (!node) continue;
    const notice = guideTargetNotice(node, state);
    if (notice) return notice;
  }
}
