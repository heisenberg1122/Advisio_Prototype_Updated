import { describe, expect, it } from "vitest";
import {
  RESEARCHER_HELP,
  researcherPageHelp,
  searchResearcherHelp,
  type ResearcherGuideState,
} from "./researcher-guide";
import { buildResearcherJourney } from "./researcher-walkthroughs";
import { resolveResearcherGuideState } from "@/hooks/use-researcher-guide-state";
import { connectedGuideGeometry } from "@/components/guide/guide-geometry";

const state: ResearcherGuideState = {
  projectKnown: true,
  projectCount: 1,
  projectId: "p1",
  hasGroup: true,
  memberCount: 2,
  isLeader: false,
  hasAdviser: true,
  classAccess: "joined",
  enrollmentCount: 1,
  hasDocuments: true,
  documentsKnown: true,
  requestError: false,
};

describe("Researcher help questions", () => {
  it.each([
    ["Where can I see my group?", "group"],
    ["JOIN CLASS", "class"],
    ["professor workflow", "class"],
    ["group code", "join-group"],
    ["dark mode", "theme"],
    ["feedback", "documents"],
    ["submt work", "submit"],
  ])("finds the appropriate answer for %s", (query, expected) => {
    expect(searchResearcherHelp(query)[0]?.id).toBe(expected);
  });

  it("provides an honest empty result for an unrelated question", () => {
    expect(searchResearcherHelp("qzxvvkj")).toEqual([]);
  });

  it("uses project subsection context and the actual group joining route", () => {
    expect(
      researcherPageHelp("/student/dashboard", "?tab=group&section=my-group"),
    ).toBe("group");
    expect(researcherPageHelp("/student/documents", "?projectId=p1")).toBe(
      "documents",
    );
    expect(researcherPageHelp("/student/join-group", "")).toBe("join-group");
  });
});

describe("State-dependent walkthroughs", () => {
  it("shows class access notices without offering a second request", () => {
    for (const classAccess of ["pending", "invited", "declined"] as const) {
      const journey = buildResearcherJourney(
        "class",
        { ...state, classAccess },
        "/student/dashboard",
      );
      expect(
        journey.steps.flatMap((step) =>
          step.targets.map((target) => target.key),
        ),
      ).toContain("class-access-" + classAccess);
      expect(journey.steps.some((step) => step.id === "class-code")).toBe(
        false,
      );
    }
  });

  it("keeps unavailable data distinct from verified empty documents or class access", () => {
    const documents = buildResearcherJourney(
      "documents",
      { ...state, hasDocuments: false, documentsKnown: false },
      "/student/documents",
    );
    expect(
      documents.steps.some((step) => step.id === "documents-unavailable"),
    ).toBe(true);
    expect(documents.steps.some((step) => step.id === "documents-empty")).toBe(
      false,
    );
    const unknown = buildResearcherJourney(
      "class",
      { ...state, classAccess: "unknown" },
      "/student/dashboard",
    );
    expect(unknown.steps.some((step) => step.id === "class-code")).toBe(false);
  });

  it("skips the working-files tab when no project is selected", () => {
    const { steps } = buildResearcherJourney(
      "documents",
      { ...state, projectId: null, hasDocuments: false },
      "/student/documents",
    );
    expect(steps.map((step) => step.id)).toEqual(["documents-nav", "documents-empty"]);
  });

  it("does not invent a member list when there is no group", () => {
    const journey = buildResearcherJourney(
      "group",
      { ...state, hasGroup: false, memberCount: 0 },
      "/student/dashboard",
    );
    expect(journey.steps.some((step) => step.id === "members")).toBe(false);
    expect(journey.steps.some((step) => step.id === "group-empty")).toBe(true);
  });

  it("starts at the existing group-code interface when already there", () => {
    expect(
      buildResearcherJourney("join-group", state, "/student/join-group")
        .steps[0].id,
    ).toBe("group-code");
    expect(
      buildResearcherJourney("join-group", state, "/join-group").steps[0].id,
    ).toBe("group-code");
  });

  it("gives the introduction a reachable final step", () => {
    const steps = buildResearcherJourney(
      "introduction",
      state,
      "/student/documents",
    ).steps;
    expect(steps[0].route).toBe("/student/dashboard");
    expect(steps.at(-1)?.id).toBe("guide-return");
    expect(steps.some((step) => step.id === "finish")).toBe(false);
  });

  it("keeps all walkthrough branches valid and identifiers unique", () => {
    for (const topic of [
      ...RESEARCHER_HELP.map((topic) => topic.id),
      "introduction",
    ] as const) {
      const steps = buildResearcherJourney(
        topic,
        state,
        "/student/dashboard",
      ).steps;
      const ids = steps.map((step) => step.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const step of steps) {
        for (const next of [
          step.next,
          ...step.targets.map((target) => target.next),
        ].filter(Boolean)) {
          expect(next === "finish" || ids.includes(next!)).toBe(true);
        }
      }
    }
  });
});

describe("Authorized guide context", () => {
  const context = {
    projects: [
      { id: "p1", members: [{ userId: "s1", projectRole: "MEMBER" }] },
    ],
    requestedProjectId: null,
    activeProjectId: null,
    userId: "s1",
    enrollments: [],
    removedIds: [],
    entries: [],
    workspaces: [],
    documents: [],
    documentsKnown: true,
    projectKnown: true,
    requestError: false,
    workflowId: null,
  };

  it("never substitutes the sole project for an unauthorized requested project", () => {
    const result = resolveResearcherGuideState({
      ...context,
      requestedProjectId: "private-project",
    });
    expect(result.projectId).toBeNull();
    expect(result.hasGroup).toBe(false);
  });

  it("requires a selection among multiple projects", () => {
    const result = resolveResearcherGuideState({
      ...context,
      projects: [...context.projects, { id: "p2" }],
    });
    expect(result.projectId).toBeNull();
  });

  it("can show a group before its research title has been registered", () => {
    const result = resolveResearcherGuideState({
      ...context,
      projects: [],
      workspaces: [
        { id: "workspace", members: [{ userId: "s1", role: "LEADER" }] },
      ],
    });
    expect(result.hasGroup).toBe(true);
    expect(result.isLeader).toBe(true);
    expect(result.projectId).toBeNull();
  });

  it("does not treat a pending request as active enrollment", () => {
    const result = resolveResearcherGuideState({
      ...context,
      entries: [
        {
          kind: "REQUEST",
          status: "PENDING",
          workflow: { name: "Professor class" },
        },
      ],
    });
    expect(result.classAccess).toBe("pending");
    expect(result.enrollmentCount).toBe(0);
  });
});

describe("Connected arrows", () => {
  it.each([320, 390, 768, 1366])(
    "keeps the tooltip beside the real control at width %i",
    (width) => {
      const target = {
        left: 16,
        top: 400,
        right: 244,
        bottom: 444,
        width: 228,
        height: 44,
      };
      const tooltip = { width: Math.min(336, width - 24), height: 290 };
      const geometry = connectedGuideGeometry(target, tooltip, {
        width,
        height: 844,
      });
      expect(geometry.left).toBeGreaterThanOrEqual(12);
      expect(geometry.left + tooltip.width).toBeLessThanOrEqual(width - 12);
      expect(geometry.top).toBeGreaterThanOrEqual(12);
      const distance = Math.hypot(
        Math.max(
          target.left - geometry.end.x,
          0,
          geometry.end.x - target.right,
        ),
        Math.max(
          target.top - geometry.end.y,
          0,
          geometry.end.y - target.bottom,
        ),
      );
      expect(distance).toBe(5);
      expect(geometry.path).toContain("L " + geometry.end.x);
    },
  );
});
