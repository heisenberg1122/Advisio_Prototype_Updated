import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  resolvePostLoginAction,
  getRememberedWorkspaceId,
  setRememberedWorkspaceId,
  clearRememberedWorkspaceId,
  isOnboardingCompletedInSession,
  markOnboardingCompletedInSession,
  resetOnboardingForSession,
} from "./post-login-navigation";

describe("Post-login Navigation Resolver", () => {
  it("prioritizes academic setup when needed", () => {
    const action = resolvePostLoginAction({
      roles: ["RESEARCHER"],
      needsAcademicSetup: true,
    });
    expect(action.type).toBe("ACADEMIC_SETUP");
    expect(action.url).toBe("/google-onboarding");
  });

  it("handles accounts with zero eligible roles", () => {
    const action = resolvePostLoginAction({
      roles: [],
    });
    expect(action.type).toBe("NO_ROLE");
    expect(action.url).toBe("/choose-dashboard?state=no-role");
  });

  it("routes single-role users directly without onboarding", () => {
    const researcherAction = resolvePostLoginAction({
      roles: ["RESEARCHER"],
    });
    expect(researcherAction.type).toBe("SINGLE_ROLE");
    if (researcherAction.type === "SINGLE_ROLE") {
      expect(researcherAction.url).toBe("/student/dashboard");
      expect(researcherAction.workspace.id).toBe("researcher");
    }

    const adviserAction = resolvePostLoginAction({
      roles: ["ADVISER"],
    });
    expect(adviserAction.type).toBe("SINGLE_ROLE");
    if (adviserAction.type === "SINGLE_ROLE") {
      expect(adviserAction.url).toBe("/adviser/dashboard");
      expect(adviserAction.workspace.id).toBe("adviser");
    }
  });

  it("resumes authorized return URL for single-role user", () => {
    const action = resolvePostLoginAction({
      roles: ["ADVISER"],
      returnUrl: "/adviser/advisees/group-123",
    });
    expect(action.type).toBe("SINGLE_ROLE");
    if (action.type === "SINGLE_ROLE") {
      expect(action.url).toBe("/adviser/advisees/group-123");
      expect(action.resumedReturnUrl).toBe(true);
    }
  });

  it("ignores return URL if it belongs to an unauthorized role for single-role user", () => {
    const action = resolvePostLoginAction({
      roles: ["ADVISER"],
      returnUrl: "/student/documents",
    });
    expect(action.type).toBe("SINGLE_ROLE");
    if (action.type === "SINGLE_ROLE") {
      expect(action.url).toBe("/adviser/dashboard");
      expect(action.resumedReturnUrl).toBe(false);
    }
  });

  it("routes multi-role users to /choose-dashboard with preselection", () => {
    // DEAN + RESEARCH_COORDINATOR (Dean + Coordinator)
    const action = resolvePostLoginAction({
      roles: ["DEAN", "RESEARCH_COORDINATOR"],
    });
    expect(action.type).toBe("CHOOSE_DASHBOARD");
    if (action.type === "CHOOSE_DASHBOARD") {
      expect(action.eligibleWorkspaces.map((w) => w.id)).toEqual([
        "coordinator",
        "dean",
      ]);
      // First in order is coordinator
      expect(action.preselectedWorkspace.id).toBe("coordinator");
    }
  });

  it("preselects valid remembered workspace for multi-role accounts", () => {
    const action = resolvePostLoginAction({
      roles: ["DEAN", "RESEARCH_COORDINATOR"],
      rememberedWorkspaceId: "dean",
    });
    expect(action.type).toBe("CHOOSE_DASHBOARD");
    if (action.type === "CHOOSE_DASHBOARD") {
      expect(action.preselectedWorkspace.id).toBe("dean");
    }
  });

  it("preselects authorized return URL workspace and preserves param", () => {
    const action = resolvePostLoginAction({
      roles: ["PANELIST", "RESEARCH_COORDINATOR"],
      returnUrl: "/panelist/defenses/session-99",
    });
    expect(action.type).toBe("CHOOSE_DASHBOARD");
    if (action.type === "CHOOSE_DASHBOARD") {
      expect(action.preselectedWorkspace.id).toBe("panelist");
      expect(action.url).toBe(
        "/choose-dashboard?returnUrl=%2Fpanelist%2Fdefenses%2Fsession-99"
      );
      expect(action.safeReturnUrl).toBe("/panelist/defenses/session-99");
    }
  });

  it("ignores unsafe return URLs", () => {
    const action = resolvePostLoginAction({
      roles: ["PANELIST", "RESEARCH_COORDINATOR"],
      returnUrl: "https://evil.com/phishing",
    });
    expect(action.type).toBe("CHOOSE_DASHBOARD");
    if (action.type === "CHOOSE_DASHBOARD") {
      expect(action.url).toBe("/choose-dashboard");
      expect(action.safeReturnUrl).toBeUndefined();
    }
  });

  describe("Session and Preference Storage Helpers", () => {
    let localStore: Record<string, string> = {};
    let sessionStore: Record<string, string> = {};

    beforeEach(() => {
      localStore = {};
      sessionStore = {};
      vi.stubGlobal("window", {});
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => localStore[k] ?? null,
        setItem: (k: string, v: string) => {
          localStore[k] = v;
        },
        removeItem: (k: string) => {
          delete localStore[k];
        },
        clear: () => {
          localStore = {};
        },
      });
      vi.stubGlobal("sessionStorage", {
        getItem: (k: string) => sessionStore[k] ?? null,
        setItem: (k: string, v: string) => {
          sessionStore[k] = v;
        },
        removeItem: (k: string) => {
          delete sessionStore[k];
        },
        clear: () => {
          sessionStore = {};
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("persists and clears remembered workspace preference", () => {
      expect(getRememberedWorkspaceId("user-1")).toBeNull();
      setRememberedWorkspaceId("user-1", "coordinator");
      expect(getRememberedWorkspaceId("user-1")).toBe("coordinator");
      clearRememberedWorkspaceId("user-1");
      expect(getRememberedWorkspaceId("user-1")).toBeNull();
    });

    it("manages session onboarding completion marker", () => {
      expect(isOnboardingCompletedInSession("user-1")).toBe(false);
      markOnboardingCompletedInSession("user-1");
      expect(isOnboardingCompletedInSession("user-1")).toBe(true);
      resetOnboardingForSession("user-1");
      expect(isOnboardingCompletedInSession("user-1")).toBe(false);
    });
  });
});
