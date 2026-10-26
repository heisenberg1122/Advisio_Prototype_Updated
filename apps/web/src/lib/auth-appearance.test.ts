import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { usesDefaultAuthAppearance } from "./auth-appearance";

const bootstrap = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
  .match(/<script>([\s\S]*?)<\/script>/)![1];

function initialAppearance(pathname: string, appearance: string, authenticated = true) {
  const storage = new Map([
    ["advisio_theme:active", appearance],
    ["advisio_college-theme:active", "bsit"],
    ["advisio_theme:user-1", appearance],
  ]);
  if (authenticated) storage.set("advisio_token", "saved-session");
  const originalStorage = new Map(storage);
  const classes = new Set<string>();
  const root = {
    classList: {
      toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
    },
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  };
  runInNewContext(bootstrap, {
    window: { location: { pathname }, matchMedia: () => ({ matches: true }) },
    document: { documentElement: root },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null },
  });
  expect(storage).toEqual(originalStorage);
  return { dark: classes.has("dark"), ...root.dataset, ...root.style };
}

describe("authentication screen appearance", () => {
  const authRoutes = [
    "/login", "/register", "/forgot-password", "/reset-password",
    "/first-login-setup", "/google-onboarding", "/researcher-onboarding", "/choose-dashboard",
  ];

  it.each(authRoutes)("keeps %s light with default colors despite a saved session", (route) => {
    for (const pathname of [route, `${route}/`]) {
      expect(usesDefaultAuthAppearance(pathname)).toBe(true);
      for (const appearance of ["light", "dark", "system"]) {
        expect(initialAppearance(pathname, appearance)).toEqual({
          dark: false, appearance: "light", collegeTheme: "default", colorScheme: "light",
        });
      }
    }
  });

  it.each(["/student/dashboard", "/admin/settings", "/calendar", "/login-history"])(
    "preserves the saved account theme on %s", (pathname) => {
      expect(usesDefaultAuthAppearance(pathname)).toBe(false);
      expect(initialAppearance(pathname, "dark")).toEqual({
        dark: true, appearance: "dark", collegeTheme: "bsit", colorScheme: "dark",
      });
      expect(initialAppearance(pathname, "system").dark).toBe(true);
    },
  );

  it("uses default light appearance without a session", () => {
    expect(initialAppearance("/login", "dark", false)).toEqual({
      dark: false, appearance: "light", collegeTheme: "default", colorScheme: "light",
    });
  });
});
