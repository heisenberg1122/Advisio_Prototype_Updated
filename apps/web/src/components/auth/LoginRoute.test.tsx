import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Navigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  auth: {
    user: null as { id: string; roles: string[] } | null,
    isLoading: false,
    isAuthenticated: false,
  },
}));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => harness.auth,
}));

import { LoginRoute } from "./LoginRoute";

const form = <div>Sign in form</div>;
function signedIn(roles: string[]) {
  harness.auth = {
    user: { id: "user-1", roles },
    isLoading: false,
    isAuthenticated: true,
  };
}

beforeEach(() => {
  harness.auth = { user: null, isLoading: false, isAuthenticated: false };
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => null) });
  vi.stubGlobal("sessionStorage", { getItem: vi.fn(() => null) });
});
afterEach(() => vi.unstubAllGlobals());

describe("login route session navigation", () => {
  it("waits for session restoration without flashing the login form", () => {
    harness.auth.isLoading = true;
    const html = renderToStaticMarkup(LoginRoute({ children: form }));
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Sign in form");
  });

  it("allows sign-in when signed out or the restored session has expired", () => {
    expect(renderToStaticMarkup(LoginRoute({ children: form }))).toContain(
      "Sign in form",
    );
  });

  it.each([
    ["RESEARCHER", "/student/dashboard"],
    ["ADVISER", "/adviser/dashboard"],
    ["PANELIST", "/panelist/dashboard"],
    ["RESEARCH_COORDINATOR", "/professor/dashboard"],
    ["DEAN", "/admin/dashboard?workspace=dean"],
    ["SYSTEM_ADMIN", "/system-admin/dashboard"],
  ])("replaces a stale login entry for %s", (role, destination) => {
    signedIn([role]);
    const result = LoginRoute({ children: form });
    expect(result.type).toBe(Navigate);
    expect(result.props).toMatchObject({ to: destination, replace: true });
  });

  it("preserves the dashboard chooser for unfinished multi-role onboarding", () => {
    signedIn(["ADVISER", "PANELIST"]);
    expect(LoginRoute({ children: form }).props).toMatchObject({
      to: "/choose-dashboard", replace: true,
    });
  });

  it("returns established multi-role sessions to an authorized remembered workspace", () => {
    signedIn(["ADVISER", "PANELIST"]);
    vi.mocked(localStorage.getItem).mockReturnValue("panelist");
    vi.mocked(sessionStorage.getItem).mockReturnValue("true");
    expect(LoginRoute({ children: form }).props).toMatchObject({
      to: "/panelist/dashboard", replace: true,
    });
  });

  it("ignores remembered workspaces the account cannot access", () => {
    signedIn(["ADVISER", "PANELIST"]);
    vi.mocked(localStorage.getItem).mockReturnValue("system-admin");
    vi.mocked(sessionStorage.getItem).mockReturnValue("true");
    expect(LoginRoute({ children: form }).props.to).toMatch(/^\/(adviser|panelist)\/dashboard$/);
  });

  it("keeps accounts without roles in the existing no-access flow", () => {
    signedIn([]);
    expect(LoginRoute({ children: form }).props).toMatchObject({
      to: "/choose-dashboard?state=no-role", replace: true,
    });
  });
});
