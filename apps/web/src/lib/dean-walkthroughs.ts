import {
  DEAN_HELP,
  type DeanHelpId,
} from "@research-management/shared/src/dean-help";
import type {
  GuidedControlStep,
  GuidedJourney,
} from "@/components/guide/guided-walkthrough-types";
import { pageRouteKey } from "./workspace-tours";

export function deanPageHelp(pathname: string, search: string): DeanHelpId {
  const current = pageRouteKey(pathname + search);
  return (
    DEAN_HELP.find(({ href }) => pageRouteKey(href) === current)?.id ??
    "dean-overview"
  );
}

export function buildDeanJourney(
  id: DeanHelpId | "introduction",
  permissions: readonly string[],
): GuidedJourney {
  const available = DEAN_HELP.filter(
    (entry) => !entry.permission || permissions.includes(entry.permission),
  );
  const topic = available.find((entry) => entry.id === id) ?? DEAN_HELP[0];
  const step: GuidedControlStep = {
    id: topic.id,
    title: topic.question,
    text: topic.answer[0],
    route: topic.href,
    targets: [{ key: topic.target }],
    fallback: topic.fallback,
  };
  const reading = (
    id: string,
    title: string,
    text: string,
    key: string,
  ): GuidedControlStep => ({
    id,
    title,
    text,
    targets: [{ key }],
    fallback: topic.fallback,
  });
  if (id === "introduction") {
    const sequence: [DeanHelpId, string][] = [
      ["dean-overview", "Your college overview"],
      ["dean-filters", "Narrow the scope"],
      ["dean-students", "Find your students"],
      ["dean-groups", "Find research groups"],
      ["dean-progress", "Follow up on progress and risk"],
      ["dean-advisers", "Check adviser workload"],
      ["dean-faculty", "Find faculty invitations"],
      ["dean-defenses", "Check defenses"],
      ["dean-reports", "Choose a report"],
      ["dean-announcements", "Find college announcements"],
      ["dean-settings", "Find your workspace preferences"],
    ];
    const steps = sequence.flatMap(([id, title]) => {
      const entry = available.find((topic) => topic.id === id);
      return entry
        ? [
            {
              ...reading(id, title, entry.answer[0], entry.target),
              route: entry.href,
              fallback: entry.fallback,
            },
          ]
        : [];
    });
    return { id, title: "Get started in the Dean's Office", steps };
  }

  const steps = [step];
  switch (id) {
    case "dean-groups":
    case "dean-students":
      steps.push(
        reading(
          "registry-search",
          "Search these records",
          "Use Search records after setting your program and academic year.",
          "tour:page-filter",
        ),
      );
      break;
    case "dean-defenses":
    case "dean-defense-status":
    case "dean-defense-results":
      if (id === "dean-defense-results") {
        step.targets = [
          { key: "dean-defense-completed", interaction: "click" },
        ];
      }
      steps.push({
        ...reading(
          "defense-details",
          "Check a defense record",
          "View details shows the recorded schedule, panel and release status.",
          "dean-defense-details",
        ),
        targets: [
          { key: "dean-defense-details" },
          {
            key: "dean-defense-views",
            text: "If no record is listed, try another view or widen the filters before looking for View details.",
          },
        ],
      });
      break;
    case "dean-panel-evaluation":
      step.targets = [
        {
          key: topic.target,
          emptyText:
            "No panel assignments match the current filters. Try widening the selection.",
        },
        {
          key: "dean-defense-views",
          text: "If My Panel Assignments is missing, check whether you have the Panelist role in this college.",
        },
      ];
      break;
    case "dean-reports":
      steps.push(
        reading(
          "report-filters",
          "Set the report scope",
          "Choose your program, academic year, and any filters for the selected report.",
          "tour:page-filter",
        ),
        reading(
          "report-exports",
          "Review before exporting",
          "Export PDF and Export CSV download the filtered report when the controls are available. Review the preview before using either option.",
          "dean-report-exports",
        ),
      );
      break;
    case "dean-settings":
      step.targets = [{ key: topic.target, interaction: "click" }];
      steps.push(
        reading(
          "assistant-visibility",
          "Choose when the assistant appears",
          "Use this switch to hide or restore Ask Advisio for your account in this browser.",
          "dean-assistant-switch",
        ),
      );
      break;
    case "dean-college":
      step.prepare = "profile";
      step.targets = [
        { key: "dean-college-switcher" },
        { key: "profile-menu-button", text: topic.fallback },
      ];
      break;
  }
  return { id, title: topic.question, steps };
}

export function currentDeanPanelEvaluationNotice(): string | undefined {
  const assignments = document.querySelector<HTMLElement>(
    '[data-guide="dean-panel-assignments"]',
  );
  if (!assignments) return undefined;
  if (assignments.dataset.guideEmpty === "true") {
    return "No panel assignments match the filters in this view.";
  }
  return assignments.dataset.deanPanelEvaluation === "available"
    ? "This view shows an Open Evaluation action for at least one assignment."
    : "This view shows no open evaluation for the listed assignments. Check each invitation or session for its current status.";
}
