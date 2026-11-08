import {
  ADVISER_HELP,
  adviserRoutes as route,
  type AdviserHelpId,
} from "@research-management/shared/src/adviser-help";
import type {
  GuidedControlStep,
  GuidedJourney,
  GuidedTarget,
} from "@/components/guide/guided-walkthrough-types";

export function adviserPageHelp(path: string, search: string): AdviserHelpId {
  const tab = new URLSearchParams(search).get("tab");
  if (path.startsWith("/adviser/advisees/")) return "ad-11";
  if (path === route.reviews || tab === "reviews") return "ad-07";
  if (path === route.settings) return "ad-19";
  if (path === route.inbox) return "ad-17-inbox";
  if (tab === "group-chats") return "ad-17";
  if (path === "/adviser/documents") return "ad-16";
  if (path === route.calendar || tab === "consultations") return "ad-13";
  if (tab === "history") return "ad-14";
  if (tab === "approvals") return "ad-12";
  if (tab === "progress") return "ad-20";
  if (tab === "advisees") return "ad-01";
  return "ad-03";
}

const anchor = (name: string) => "adviser-" + name;
const read = (
  id: string,
  title: string,
  text: string,
  key = anchor(id),
): GuidedControlStep => ({
  id,
  title,
  text,
  targets: [{ key }],
  fallback:
    "This control isn’t available on the current page. Check that the page loaded and that you have access. You can retry or exit to Guide.",
});
const click = (
  id: string,
  title: string,
  text: string,
  key = anchor(id),
): GuidedControlStep => ({
  ...read(id, title, text, key),
  targets: [{ key, interaction: "click", anyMatching: true }],
});
const go = (step: GuidedControlStep, href: string): GuidedControlStep => ({
  ...step,
  route: href,
});
const withFallback = (
  step: GuidedControlStep,
  target: GuidedTarget,
): GuidedControlStep => ({ ...step, targets: [...step.targets, target] });
const empty = (key: string, text: string, next = "finish"): GuidedTarget => ({
  key: anchor(key),
  text,
  next,
});

const selectGroup = (nextOnEmpty = "finish") =>
  go(
    withFallback(
      click(
        "choose-group",
        "Choose a research group",
        "Open the card for the group you want to work with.",
        anchor("group-card"),
      ),
      empty(
        "group-list",
        "No assigned group is visible here. A pending request is separate from an assigned group.",
        nextOnEmpty,
      ),
    ),
    route.groups,
  );

function groupEntry(
  onGroup: boolean,
  nextOnEmpty?: string,
): GuidedControlStep[] {
  return onGroup ? [] : [selectGroup(nextOnEmpty)];
}
const groupSections = () =>
  read(
    "group-sections",
    "Your group workspace",
    "Use the tabs to find the project overview, members, documents, milestones, consultations and activity.",
  );
const groupTab = (tab: string, title: string, text: string) =>
  click("group-" + tab, title, text);
const groupPanel = (tab: string, title: string, text: string) =>
  read("group-panel-" + tab, title, text, anchor("group-" + tab + "-content"));

const queue = () => {
  const step = read(
    "review-queue",
    "Check Pending reviews",
    "This list shows active assignments and their exact submitted version.",
  );
  step.targets[0].emptyText =
    "No manuscript reviews are waiting in this list. New work appears when you are assigned to a submitted version.";
  return go(step, route.reviews);
};
const history = () =>
  go(
    read(
      "review-history",
      "See past assignments",
      "Completed decisions and inactive assignments appear in Review history. Check the status and version before assuming a review is still open.",
      "id:review-history-heading",
    ),
    route.reviews,
  );
const reviewOpen = () =>
  go(
    withFallback(
      click(
        "review-open",
        "Open your assigned version",
        "Check the version number, then choose Review manuscript or Continue review.",
      ),
      empty(
        "review-queue",
        "No actionable review is available in this list. Review history shows past work.",
        "review-history",
      ),
    ),
    route.reviews,
  );
const recommendation = () =>
  read(
    "review-recommendation",
    "Review the decision choices",
    "This menu offers approval, minor or major revision, and rejection for the assigned version. Revisions and rejection require actionable feedback. Only you can submit a decision.",
  );

const requests = () => {
  const step = read(
    "attention",
    "Find pending adviser requests",
    "Look for Adviser Request cards here. A pending request needs your response before the group becomes assigned.",
  );
  step.targets[0].emptyText =
    "There are no pending adviser requests in Needs your attention. Assigned groups are listed separately under My Advisees.";
  return go(step, route.overview);
};
const requestDetails = () =>
  go(
    withFallback(
      click(
        "request-open",
        "Read the full request",
        "Open View full request on the card you want to inspect.",
      ),
      empty(
        "attention",
        "There is no pending request to open. Check back when a request arrives.",
      ),
    ),
    route.overview,
  );

const consultationList = () => {
  const step = read(
    "consultation-list",
    "Find requests and scheduled sessions",
    "Check the status and time on a real session. Pending approval indicates a request; confirmed sessions are already scheduled.",
  );
  step.targets[0].emptyText =
    "There are no consultations to show here yet. New requests and scheduled sessions appear in this list.";
  return go(step, route.consultations);
};
const appearance = () =>
  go(
    click(
      "appearance-tab",
      "Open Appearance",
      "Choose Appearance to find display and workspace assistance preferences.",
    ),
    route.settings,
  );

export function buildAdviserJourney(
  id: AdviserHelpId | "introduction",
  currentPath: string,
  permissions: readonly string[],
): GuidedJourney {
  const onGroup = currentPath.startsWith("/adviser/advisees/");
  let steps: GuidedControlStep[];
  switch (id) {
    case "ad-01":
    case "ad-02":
      steps = [
        ...groupEntry(onGroup),
        groupSections(),
        ...(id === "ad-02"
          ? [
              groupTab(
                "overview",
                "Open the group overview",
                "Choose Overview to see the members and recent activity.",
              ),
              groupPanel(
                "overview",
                "Check the group members",
                "This list shows active members. Documents and Activity have their own tabs.",
              ),
            ]
          : []),
      ];
      break;
    case "ad-03":
      steps = [requests()];
      break;
    case "ad-04":
      steps = [
        requestDetails(),
        read(
          "request-accept",
          "Check the response options",
          "Choose Accept request or Reject only when you’re ready. If Accept is disabled, check the capacity notice. The guide stops before you choose.",
        ),
      ];
      break;
    case "ad-05":
      steps = [
        go(
          read(
            "capacity",
            "Check current capacity",
            "This indicator shows assigned groups, the limit, and whether requests are paused or capacity is full.",
          ),
          route.groups,
        ),
      ];
      break;
    case "ad-06":
      steps = [
        queue(),
        reviewOpen(),
        {
          ...read(
            "review-snapshot",
            "Check the assigned version",
            "This is the exact submitted snapshot for the selected assignment.",
          ),
          next: "finish",
        },
        history(),
      ];
      break;
    case "ad-07":
    case "ad-08":
      steps = [
        reviewOpen(),
        ...(id === "ad-07"
          ? [
              read(
                "review-snapshot",
                "Check the submitted snapshot",
                "The review opens on the exact assigned version. Check its version and preview before writing feedback.",
              ),
              read(
                "review-feedback",
                "Find Overall feedback",
                "Summarize your decision here. Use the optional page or section fields for more specific feedback.",
              ),
              read(
                "review-previous",
                "Compare earlier decisions",
                "Check previous version numbers and decisions if they are available. Feedback remains tied to the version it was recorded on.",
              ),
            ]
          : []),
        { ...recommendation(), next: "finish" },
        history(),
      ];
      break;
    case "ad-09":
      steps = [
        ...groupEntry(onGroup),
        groupTab(
          "documents",
          "Open the group’s Documents",
          "Select Documents to find the files available for this group.",
        ),
        withFallback(
          click(
            "group-version-history",
            "Expand Version history",
            "Open Version history on the document you want. Check version numbers and access controls.",
          ),
          {
            key: anchor("group-documents-content"),
            text: "No version history is visible. Check the document list and the actual access or empty state.",
          },
        ),
      ];
      break;
    case "ad-10":
      steps = [queue(), history()];
      break;
    case "ad-11":
      steps = [
        ...groupEntry(onGroup),
        groupTab(
          "milestones",
          "Open Milestones",
          "See the group’s workflow stages and requirement statuses.",
        ),
        groupPanel(
          "milestones",
          "Read the actual progress",
          "Check completed requirements and the current stage here. A pending requirement isn’t necessarily overdue.",
        ),
        groupTab(
          "activity",
          "Find recorded activity",
          "Open Activity to check what changed.",
        ),
        groupPanel(
          "activity",
          "Check what happened",
          "Use the actual activity entries, if any, to see recent submissions, reviews and other events.",
        ),
      ];
      break;
    case "ad-20":
      steps = [
        go(
          withFallback(
            click("progress-group", "Choose an assigned group", "Choose a group to check its stage and requirements."),
            { key: anchor("progress-empty"), next: "finish", text: "There are no assigned groups to compare. Check My Advisees or the pending requests on Overview." },
          ),
          route.progress,
        ),
        read("progress-requirements", "Check the remaining requirements", "Read the status for each requirement. Use Open workspace for the group’s milestone history."),
      ];
      break;
    case "ad-12":
      steps = [
        go(
          read(
            "milestone-queue",
            "Check Milestone Approval & Recommendation",
            "This workspace does not currently show an actionable approval queue. Check the group’s Milestones tab for progress and ask your coordinator about the next approval step.",
          ),
          route.milestones,
        ),
      ];
      break;
    case "ad-13":
      steps = [
        go(
          click(
            "consultation-open",
            "Open the scheduling form",
            "Choose Schedule consultation. Opening the form won’t create a meeting.",
          ),
          route.consultations,
        ),
        {
          ...read(
            "consultation-group",
            "Select the advisee group",
            "The group picker lists the advisees you can schedule with.",
          ),
          targets: [
            {
              key: anchor("consultation-group"),
              emptyText:
                "No eligible advisee group is listed. Check My Advisees before scheduling.",
            },
          ],
        },
        read(
          "consultation-topic",
          "Give the session a topic",
          "Use this field to tell the group what you’ll discuss.",
        ),
        read(
          "consultation-date",
          "Choose the date",
          "Check the date before creating the consultation.",
        ),
        read(
          "consultation-time",
          "Choose the time",
          "Check the time and meeting details. You decide whether to submit or cancel this form.",
        ),
      ];
      break;
    case "ad-14":
      steps = [
        consultationList(),
        go(
          read(
            "consultation-history",
            "Check saved history and notes",
            "Check actual saved records. A consultation may have no notes or transcript.",
          ),
          route.history,
        ),
      ];
      break;
    case "ad-15":
      steps = [
        go(
          withFallback(
            read(
              "consultation-meeting",
              "Find the session’s meeting action",
              "This scheduled session has a meeting link. Check the group and time before joining.",
            ),
            empty(
              "consultation-list",
              "No confirmed session with a meeting link is shown here. Check the schedule or the group’s Consultations tab.",
            ),
          ),
          route.consultations,
        ),
      ];
      break;
    case "ad-16":
      steps = [
        {
          ...read(
            "official-nav",
            "Find Official Copies",
            "Open Official Copies for finalized records you’re allowed to view.",
            anchor("nav-documents"),
          ),
          prepare: "sidebar",
          to: route.official,
        },
        go(
          {
            ...read(
              "official-project",
              "Choose the research group",
              "Check the selected project or use Change project to choose the group whose copies you want to see.",
            ),
            targets: [
              { key: anchor("official-project"), interaction: "input" },
              empty(
                "official-no-projects",
                "There is no research project available here. Check your assigned groups in My Advisees.",
              ),
            ],
          },
          route.official,
        ),
        go(
          read(
            "official-copies",
            "Check the official records",
            "View or download a copy only when the action is available. These are separate from assignments in Reviews.",
          ),
          route.official,
        ),
      ];
      break;
    case "ad-17-inbox":
      steps = [
        {
          ...read(
            "inbox-nav",
            "Find formal correspondence",
            "Use Inbox for direct Advisio correspondence. Group conversations are under Messages.",
            anchor("nav-inbox"),
          ),
          prepare: "sidebar",
        },
      ];
      break;
    case "ad-17":
      steps = [
        {
          ...read(
            "messages-nav",
            "Find group conversations",
            "Use Messages for conversations with your assigned research groups.",
            anchor("nav-group-chats"),
          ),
          prepare: "sidebar",
        },
        {
          ...read(
            "inbox-nav",
            "Find formal correspondence",
            "Use Inbox for direct Advisio correspondence. Nothing is sent during this walkthrough.",
            anchor("nav-inbox"),
          ),
          prepare: "sidebar",
        },
      ];
      break;
    case "ad-18":
      steps = [
        {
          ...read(
            "theme",
            "Switch light and dark mode",
            "Use Dark Mode to change the display. This does not change the college you’re working in.",
            "appearance-toggle",
          ),
          prepare: "profile",
        },
        {
          ...withFallback(
            read(
              "college",
              "Check your active college",
              "The college selector switches the academic context and available records.",
              "adviser-college-switcher",
            ),
            {
              key: "profile-menu-button",
              text: "A college selector is available only when you have more than one approved college.",
            },
          ),
          prepare: "profile",
        },
      ];
      break;
    case "ad-19":
      steps = [
        appearance(),
        read(
          "assistant-switch",
          "Set floating Assistant visibility",
          "Turn this switch off to hide Ask Advisio on this browser. Guide stays in the sidebar above Settings.",
        ),
      ];
      break;
    case "introduction": {
      const research = permissions.includes("research.view");
      const documents = permissions.includes("document.view");
      const afterGroup = documents ? "review-queue" : "attention";
      steps = [
        ...(research
          ? [
              {
                ...requests(),
                id: "overview",
                title: "Start with what needs attention",
                text: "Overview helps you see the work waiting for you.",
                targets: [{ key: anchor("attention") }],
              },
              selectGroup(afterGroup),
              groupSections(),
              read(
                "intro-milestones",
                "See what the group is working on",
                "Milestones shows the current stage and the requirements that still need attention.",
                anchor("group-milestones"),
              ),
            ]
          : []),
        ...(documents ? [queue()] : []),
        ...(research ? [requests(), consultationList()] : []),
        {
          ...read(
            "finish-intro",
            "Find help whenever you need it",
            "Open Guide for a task walkthrough, or ask Advisio Assistant a question.",
            "guide-launcher",
          ),
          prepare: "sidebar",
        },
      ];
      break;
    }
  }
  return {
    id,
    title:
      ADVISER_HELP.find((topic) => topic.id === id)?.question ||
      "Explore the Faculty Adviser workspace",
    steps,
  };
}
