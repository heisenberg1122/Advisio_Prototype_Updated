import { describe, expect, it } from "vitest";
import { ADVISER_HELP } from "@research-management/shared/src/adviser-help";
import { searchHelpTopics } from "@research-management/shared/src/researcher-help";
import {
  authorizedAdviserHelp,
  normalizeGuideQuestion,
} from "@research-management/shared/src/guide-help";
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

  it("keeps Guide topics scoped to Adviser permissions without AI", () => {
    expect(
      authorizedAdviserHelp([]).some((topic) => topic.id === "ad-07"),
    ).toBe(false);
    expect(
      authorizedAdviserHelp(["document.view"]).some(
        (topic) => topic.id === "ad-07",
      ),
    ).toBe(true);
    expect(
      authorizedAdviserHelp([]).find((topic) => topic.id === "ad-17-inbox")
        ?.href,
    ).toBe("/adviser/inbox");
    expect(
      authorizedAdviserHelp([]).some((topic) => String(topic.id) === "class"),
    ).toBe(false);
  });

  it("keeps Taglish help search available without AI", () => {
    expect(
      searchHelpTopics(
        normalizeGuideQuestion("saan makikita my group"),
        ADVISER_HELP,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("keeps Settings help accurate for TAM without an Assistant control", () => {
    const topic = ADVISER_HELP.find((topic) => topic.id === "ad-19")!;
    expect(topic.question).toBe("How do I find my settings?");
    expect(topic.answer.join(" ")).not.toMatch(/assistant/i);
    const journey = buildAdviserJourney(topic.id, "/adviser/dashboard", []);
    expect(journey.steps.length).toBeGreaterThan(0);
    expect(JSON.stringify(journey)).not.toMatch(/assistant/i);
    expect(journey.steps[0].route).toBe("/adviser/settings");
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
          if (/accept|approve|recommendation|meeting$/.test(target.key)) {
            expect(target.interaction).toBeUndefined();
          }
        }
      }
    }
  });
});
