import { describe, expect, it } from "vitest";
import { PANELIST_HELP } from "@research-management/shared/src/panelist-help";
import {
  resolveAssistantAction,
  resolveAssistantQuestion,
} from "@research-management/shared/src/researcher-assistant";
import {
  buildPanelistJourney,
  panelistPageHelp,
} from "./panelist-walkthroughs";

describe("Panelist Guide and Assistant", () => {
  it.each([
    ["Saan ang defense schedule ko?", "pn-04"],
    ["Where do I accept my defense invitation?", "pn-03"],
    ["How do I review the defense manuscript?", "pn-07"],
    ["How do I submit my defense evaluation?", "pn-13"],
    ["Where can I see my completed evaluation?", "pn-15"],
    ["Where is the official decision?", "pn-16"],
    ["Why can’t I see the decision?", "pn-16"],
  ])("answers %s with verified help", (question, id) => {
    expect(
      resolveAssistantQuestion(question, [], undefined, "panelist"),
    ).toMatchObject({ kind: "local", topic: { id } });
  });

  it("separates ambiguous help and forbids cross-workspace actions", () => {
    expect(
      resolveAssistantQuestion("review", [], undefined, "panelist").kind,
    ).toBe("clarification");
    expect(resolveAssistantAction("ad-07:navigate", [], "panelist")).toBeNull();
    expect(resolveAssistantAction("pn-07:navigate", [], "adviser")).toBeNull();
    expect(resolveAssistantAction("pn-07:publish", [], "panelist")).toBeNull();
  });

  it("uses the current authorized session's rendered controls", () => {
    const session = "/panelist/defenses/assigned-session";
    expect(panelistPageHelp(session, "")).toBe("pn-05");
    expect(buildPanelistJourney("pn-07", session).steps[0]).toMatchObject({
      id: "open-packet",
      targets: [
        { key: "panelist-open-packet", interaction: "click" },
        { key: "panelist-session", next: "finish" },
      ],
    });
    expect(
      buildPanelistJourney("pn-13", session).steps[0].route,
    ).toBeUndefined();
  });

  it("defines all 20 topics and reserves interaction for opening views", () => {
    expect(new Set(PANELIST_HELP.map(({ id }) => id)).size).toBe(20);
    for (const { id } of PANELIST_HELP) {
      for (const href of [
        "/panelist/dashboard",
        "/panelist/defenses/current",
        "/panelist/dashboard?tab=documents",
      ]) {
        const { steps } = buildPanelistJourney(id, href);
        expect(steps.length).toBeGreaterThan(0);
        for (const step of steps) {
          if (step.route)
            expect(step.route.startsWith("/panelist/")).toBe(true);
          for (const target of step.targets) {
            if (target.interaction) {
              expect(target.key).toMatch(
                /^panelist-(open-(session|packet|evaluation)|review-open|(manuscript|notes|recommendation|appearance)-tab)$/,
              );
            }
          }
        }
      }
    }
  });
});
