import { describe, expect, it } from "vitest";
import { ADVISER_HELP } from "@research-management/shared/src/adviser-help";
import { searchHelpTopics } from "@research-management/shared/src/researcher-help";
import { resolveAssistantAction } from "@research-management/shared/src/researcher-assistant";
import { adviserPageHelp, buildAdviserJourney } from "./adviser-walkthroughs";

describe("Adviser Guide", () => {
  it("finds review topics using partial search and a paraphrase", () => {
    expect(
      searchHelpTopics("review", ADVISER_HELP).map(({ id }) => id),
    ).toContain("ad-07");
    expect(searchHelpTopics("review a draft", ADVISER_HELP)[0]?.id).toBe(
      "ad-07",
    );
  });

  it("keeps executable actions scoped to the Adviser workspace and permissions", () => {
    expect(
      resolveAssistantAction("class:navigate", ["document.view"], "adviser"),
    ).toBeNull();
    expect(resolveAssistantAction("ad-07:show", [])).toBeNull();
    expect(resolveAssistantAction("ad-07:show", [], "adviser")).toBeNull();
    expect(
      resolveAssistantAction("ad-17-inbox:navigate", [], "adviser")?.topic.href,
    ).toBe("/adviser/inbox");
  });

  it("preserves the current group when opening its progress walkthrough", () => {
    const pathname = "/adviser/advisees/authorized-group";
    const topic = adviserPageHelp(pathname, "?section=overview");
    expect(topic).toBe("ad-11");
    const journey = buildAdviserJourney(topic, pathname, ["research.view"]);
    expect(journey.steps[0]).toMatchObject({
      id: "group-milestones",
      targets: [{ key: "adviser-group-milestones", interaction: "click" }],
    });
    expect(journey.steps.some((step) => step.route)).toBe(false);
  });

  it("only observes approval and decision controls", () => {
    for (const topic of ADVISER_HELP) {
      const journey = buildAdviserJourney(topic.id, "/adviser/dashboard", [
        "research.view",
        "document.view",
      ]);
      for (const step of journey.steps) {
        for (const target of step.targets) {
          if (
            /accept|approve|recommendation|meeting$|assistant-switch/.test(
              target.key,
            )
          ) {
            expect(target.interaction).toBeUndefined();
          }
        }
      }
    }
  });
});
