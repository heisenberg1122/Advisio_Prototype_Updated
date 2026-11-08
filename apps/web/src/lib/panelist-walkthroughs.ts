import {
  PANELIST_HELP,
  panelistRoutes as routes,
  type PanelistHelpId,
} from "@research-management/shared/src/panelist-help";
import type {
  GuidedControlStep,
  GuidedJourney,
  GuidedTarget,
} from "@/components/guide/guided-walkthrough-types";

export function panelistPageHelp(path: string, search: string): PanelistHelpId {
  const tab = new URLSearchParams(search).get("tab");
  if (path.startsWith("/panelist/defenses/")) return "pn-05";
  if (path === routes.reviews) return "pn-06";
  if (path === "/panelist/documents") return "pn-17";
  if (path === routes.calendar || path === routes.consultations) return "pn-18";
  if (path === routes.inbox) return "pn-19";
  if (path === routes.settings) return "pn-20";
  switch (tab) {
    case "schedule":
      return "pn-04";
    case "documents":
      return "pn-07";
    case "evaluation":
      return "pn-11";
    case "grades":
      return "pn-16";
    case "messages":
      return "pn-19";
    default:
      return "pn-01";
  }
}

const evaluationStatus: Readonly<Record<string, string>> = {
  locked:
    "This evaluation was submitted and is locked. You can view the completed record when its link is available.",
  editable:
    "This form is open for scoring. You can continue your draft using the displayed evaluation controls.",
  closed: "This defense has ended, so this evaluation form is closed.",
  "no-live-session":
    "Scoring isn’t open right now. Check the defense schedule or session readiness for the latest status.",
  "no-assignment":
    "There is no defense assignment displayed in this college right now. Check Defense Schedule for invitations.",
  "session-unavailable":
    "The selected evaluation is unavailable in this view. Open the defense from your current Defense Schedule to check your access and readiness.",
  "missing-rubric":
    "This defense is live, but a published evaluation rubric is unavailable. Check with the session facilitator.",
  unverified:
    "This view couldn’t confirm an editable evaluation. Read the status on the form or check the session’s readiness.",
};

export function currentPanelistEvaluationNotice() {
  const form = document.querySelector('[data-guide="panelist-evaluation"]');
  const state = form?.querySelector<HTMLElement>(
    "[data-panelist-evaluation-state]",
  )?.dataset.panelistEvaluationState;
  return state && Object.prototype.hasOwnProperty.call(evaluationStatus, state)
    ? evaluationStatus[state]
    : undefined;
}

const target = (
  key: string,
  options?: Omit<GuidedTarget, "key">,
): GuidedTarget => ({ key: `panelist-${key}`, ...options });
const click = (key: string): GuidedTarget =>
  target(key, { interaction: "click", anyMatching: true });

const step = (
  id: string,
  title: string,
  text: string,
  targets: GuidedTarget[] = [target(id)],
  route?: string,
): GuidedControlStep => ({
  id,
  title,
  text,
  targets,
  route,
  fallback:
    "This control is unavailable here. Check the page’s status or your assignment. You can retry or return to Guide.",
});

const overview = () =>
  step(
    "overview",
    "Your assigned work",
    "Start here to see assigned projects and upcoming defenses.",
    [{ key: "id:pe-queue", text: "Check the evaluation queue for work that still needs your score." }],
    routes.overview,
  );
const schedule = () =>
  step(
    "schedule",
    "Defense Schedule",
    "Check the session’s date, venue when available, and schedule status. A tentative date may change.",
    [
      { key: "id:ps-waiting", text: "Start with invitations waiting for your response. Confirm the date and venue before responding." },
      { key: "id:ps-upcoming", text: "Check the date, venue, and status of upcoming or live defenses." },
      { key: "id:ps-completed", text: "Completed and closed sessions appear in this list." },
      { key: "id:ps-empty", text: "Assigned defenses appear here after an invitation becomes available." },
    ],
    routes.schedule,
  );
const invitation = () =>
  step(
    "invitation",
    "Invitation status",
    "The invitation status on each defense card shows whether you need to respond or reconfirm.",
    [
      target("invitation"),
      { key: "id:ps-title", text: "Check the listed sessions for an invitation in your name. Panel assignments appear here once available." },
    ],
    routes.schedule,
  );
const chooseSession = (nextOnEmpty = "finish") =>
  step(
    "open-session",
    "Open a defense",
    "Choose Open defense workspace on the session you want to check.",
    [
      click("open-session"),
      target("schedule-empty", {
        text: "There are no assigned defenses displayed here yet.",
        next: nextOnEmpty,
      }),
    ],
    routes.schedule,
  );
const session = () =>
  step(
    "session",
    "Session readiness",
    "Use this workspace to check your invitation, packet, manuscript review and evaluation readiness.",
  );
const packetPicker = () =>
  step(
    "packet-list",
    "Choose a defense packet",
    "Check which defense is selected and choose the published packet you want to review.",
    [
      target("packet-list"),
      target("packet-empty", {
        text: "There’s no packet available in this view. Check your invitation status and whether the packet has been published.",
        next: "finish",
      }),
    ],
    routes.packet,
  );
const packetTab = (id: string, title: string, text: string) =>
  step(id + "-tab", title, text, [click(id + "-tab")]);
const queue = () =>
  step(
    "review-queue",
    "Manuscript Reviews",
    "This queue contains general manuscript review assignments. A defense packet is tied to a specific defense.",
    [target("review-queue")],
    routes.reviews,
  );
const openAssignment = () =>
  step(
    "review-open",
    "Choose an assigned version",
    "Open the review for the version you want to inspect.",
    [
      click("review-open"),
      target("review-queue", {
        text: "There’s no visible assignment to open. Check the queue filters and your access.",
        next: "finish",
      }),
    ],
    routes.reviews,
  );
const evaluation = () =>
  step(
    "evaluation",
    "Evaluation status",
    "Check the displayed status for this session. Your configured form can be structured, PDF, or a legacy rubric. Scoring depends on availability and the session being live.",
    [
      target("evaluation-locked", {
        text: "This evaluation is locked. Use its view or PDF controls if available.",
      }),
      target("evaluation-not-live", {
        text: "The scoring form is waiting for a live defense session. Read the status shown here for any additional details.",
      }),
      target("evaluation-unavailable", {
        text: "Scoring is unavailable. Read the page’s message for the specific requirement or error.",
      }),
      target("save-draft", { text: "The evaluation form is open. Save draft keeps your work private while scoring is available." }),
    ],
    routes.evaluation,
  );
const results = () =>
  step(
    "results",
    "Results",
    "Your own completed evaluation and the official decision are separate. Look for the official release status.",
    [{ key: "id:pr-awaiting" }, { key: "id:pr-released" }, { key: "id:pr-empty" }],
    routes.results,
  );
const sidebar = (
  id: string,
  title: string,
  text: string,
  route?: string,
): GuidedControlStep => ({
  ...step(id, title, text, [target("nav-" + id)], route),
  prepare: "sidebar",
});

export function buildPanelistJourney(
  id: PanelistHelpId | "introduction",
  href: string,
): GuidedJourney {
  const url = new URL(href, "https://advisio.local");
  const onSession = url.pathname.startsWith("/panelist/defenses/");
  const onPacket = panelistPageHelp(url.pathname, url.search) === "pn-07";
  const packetEntry = () =>
    onSession
      ? [
          step(
            "open-packet",
            "Open the published packet",
            "If your invitation and packet are ready, choose Open defense documents to open this session’s defense materials.",
            [
              click("open-packet"),
              target("session", {
                text: "Use the readiness information to check why this session’s packet isn’t available.",
                next: "finish",
              }),
            ],
          ),
          { ...packetPicker(), route: undefined },
        ]
      : [packetPicker()];
  const evalEntry = () =>
    onSession
      ? [
          step(
            "open-evaluation",
            "Open the configured evaluation",
            "Choose the evaluation for this session if the workspace offers it.",
            [
              click("open-evaluation"),
              target("session", {
                text: "Check this session’s readiness to see what is still required before you can score.",
                next: "finish",
              }),
            ],
          ),
          { ...evaluation(), route: undefined },
        ]
      : [evaluation()];
  let steps: GuidedControlStep[];
  switch (id) {
    case "introduction":
    case "pn-01":
      steps = [
        overview(),
        schedule(),
        chooseSession("evaluation"),
        session(),
        queue(),
        evaluation(),
        results(),
        sidebar(
          "documents",
          "Official Copies",
          "Use Official Copies for authorized archival documents.",
        ),
        step(
          "guide",
          "Come back anytime",
          "Open Guide or ask Advisio Assistant when you need help with a specific task.",
          [{ key: "guide-launcher" }],
        ),
      ];
      steps[steps.length - 1].prepare = "sidebar";
      break;
    case "pn-02":
      steps = [invitation()];
      break;
    case "pn-03":
      steps = [
        invitation(),
        step(
          "invite-actions",
          "Choose your response",
          "Accept invitation records your acceptance. If you’re unavailable, open the decline form to enter a reason. Verify the schedule before you decide.",
          [
            target("invite-actions"),
            { key: "id:ps-title", text: "There is no pending response control visible. Check the invitation status on your session." },
          ],
        ),
      ];
      break;
    case "pn-04":
      steps = [schedule(), chooseSession(), session()];
      break;
    case "pn-05":
      steps = onSession ? [session()] : [chooseSession(), session()];
      break;
    case "pn-06":
      steps = [queue(), packetPicker()];
      break;
    case "pn-07":
      steps = [
        ...packetEntry(),
        packetTab(
          "manuscript",
          "Published manuscript",
          "Open Manuscript to see the version published for this defense.",
        ),
        step(
          "manuscript",
          "Review the published version",
          "Check the published version label and preview. Use the available annotation tools to review it.",
        ),
        packetTab(
          "notes",
          "Notes & revisions",
          "Open Notes & revisions for the checklist and review controls.",
        ),
        step(
          "notes",
          "Review notes and checklist",
          "Check which notes stay private and which controls share feedback. Complete the review only when you’re ready.",
        ),
      ];
      break;
    case "pn-08":
      steps = [
        openAssignment(),
        step(
          "review-snapshot",
          "Verify the assigned version",
          "Read the version shown in this review before adding feedback.",
        ),
        step(
          "review-feedback",
          "Feedback and recommendation",
          "Use the available feedback and recommendation controls for this exact version. Review your decision before submitting.",
          [
            target("review-feedback"),
            target("review-snapshot", {
              text: "The snapshot is available, but an editable feedback field isn’t visible for this assignment.",
            }),
          ],
        ),
      ];
      break;
    case "pn-09":
      steps = onPacket
        ? [
            packetTab(
              "manuscript",
              "Manuscript versions",
              "Open Manuscript to find the published file and version history.",
            ),
            step(
              "packet-history",
              "Version history",
              "Compare the version labels before opening an earlier file. Earlier manuscript reviews may be read-only.",
              [
                target("packet-history"),
                target("manuscript", {
                  text: "No version history is visible for this packet.",
                }),
              ],
            ),
          ]
        : [
            openAssignment(),
            step(
              "review-previous",
              "Previous versions and decisions",
              "Look here for earlier versions and their recorded decisions. Your current feedback applies to the assigned version.",
            ),
          ];
      break;
    case "pn-10":
      steps = [
        ...packetEntry(),
        step(
          "recommendation-tab",
          "Recommendation form",
          "Open the recommendation form when this defense offers a separate one.",
          [
            click("recommendation-tab"),
            target("packet-list", {
              text: "There is no separate recommendation tab visible. Structured evaluation can include the recommendation in the evaluation itself.",
              next: "finish",
            }),
          ],
        ),
        step(
          "recommendation",
          "Review the draft and preview",
          "Complete the available fields and review the preview. Confirm & lock finalizes the form.",
        ),
      ];
      break;
    case "pn-11":
    case "pn-14":
      steps = evalEntry();
      break;
    case "pn-12":
      steps = [
        ...evalEntry(),
        step(
          "save-draft",
          "Save a private draft",
          "Save draft records your current entries. Check the form status before leaving. Your draft stays editable while scoring is open.",
          [
            target("save-draft"),
            target("evaluation", {
              text: "Save draft isn’t available on this view. Check the session and evaluation status.",
            }),
          ],
        ),
      ];
      break;
    case "pn-13":
      steps = [
        ...evalEntry(),
        step(
          "final-evaluation",
          "Review before final submission",
          "Complete the required fields and use the confirmation shown for this rubric. Final submission locks your evaluation.",
          [
            target("evaluation-structured-preview", {
              text: "Complete the required answers, review the evaluation PDF, and confirm only when you’re ready to lock your submission.",
            }),
            target("evaluation-pdf-preview", {
              text: "Review the PDF and any required signature placement. The final confirmation submits and locks it.",
            }),
            target("final-evaluation"),
            target("evaluation", {
              text: "A final submission control isn’t available here. Check the form’s status for the reason.",
            }),
          ],
        ),
      ];
      break;
    case "pn-15":
      steps = [
        results(),
        step(
          "completed-evaluation",
          "Your completed evaluation",
          "Use View my completed evaluation when the record offers it.",
          [
            target("completed-evaluation"),
            { key: "id:pr-title", text: "There is no completed evaluation link visible. Check your submitted records for this defense." },
          ],
        ),
      ];
      break;
    case "pn-16":
      steps = [
        results(),
        step(
          "release-status",
          "Official decision",
          "Check the release label. A pending decision remains separate from your own locked evaluation.",
          [
            target("release-status"),
            { key: "id:pr-title", text: "No official decision is visible for this view. Check back after the authorized release." },
          ],
        ),
      ];
      break;
    case "pn-17":
      steps = [
        step(
          "official",
          "Official Copies",
          "Select the relevant project and use the preview or download controls for the files you can access.",
          [
            target("official"),
            target("official-projects", {
              text: "Check the project selector and file availability for this college.",
            }),
          ],
          routes.official,
        ),
      ];
      break;
    case "pn-18":
      steps = [
        sidebar(
          "consultations",
          "Consultations",
          "Open Consultations to check the faculty consultation workspace and options you can use.",
          routes.consultations,
        ),
        sidebar(
          "calendar",
          "Calendar",
          "Use Calendar to see available events in the selected college.",
          routes.calendar,
        ),
      ];
      break;
    case "pn-19":
      steps = [
        sidebar(
          "messages",
          "Group messages",
          "Messages lists conversations available in this workspace. Confirm the group before sending.",
          routes.messages,
        ),
        sidebar(
          "inbox",
          "Inbox",
          "Use Inbox for available direct conversations. Check the recipient before sending.",
          routes.inbox,
        ),
      ];
      break;
    case "pn-20":
      steps = [
        step(
          "appearance",
          "Appearance",
          "Open Appearance to find the theme and assistance preferences.",
          [click("appearance-tab")],
          routes.settings,
        ),
        step(
          "assistant-switch",
          "Floating AI Assistant",
          "This switch controls the floating button. Guide remains available either way.",
        ),
      ];
      break;
  }
  return {
    id,
    title:
      PANELIST_HELP.find((topic) => topic.id === id)?.question ??
      "Explore the Panelist workspace",
    steps,
  };
}
