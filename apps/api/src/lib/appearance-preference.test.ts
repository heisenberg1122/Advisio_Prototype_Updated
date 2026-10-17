import { describe, expect, it } from "vitest";
import {
  effectiveColorThemePreference,
  parseColorThemePreference,
} from "./appearance-preference.js";

describe("appearance preference policy", () => {
  it.each([
    ["DEFAULT_ADVISIO", "DEFAULT_ADVISIO"],
    ["default_advisio", "DEFAULT_ADVISIO"],
    ["COLLEGE_PROGRAM", "COLLEGE_PROGRAM"],
    ["college_program", "COLLEGE_PROGRAM"],
  ] as const)("accepts the supported color theme preference %s", (input, expected) => {
    expect(parseColorThemePreference(input)).toBe(expected);
  });

  it.each([undefined, null, "", "DEFAULT", "BSIT", "SYSTEM"])(
    "rejects unsupported color theme preference %s",
    (input) => {
      expect(parseColorThemePreference(input)).toBeNull();
    },
  );

  it("preserves a regular user's college/program preference", () => {
    expect(effectiveColorThemePreference("COLLEGE_PROGRAM", ["RESEARCHER"])).toBe(
      "COLLEGE_PROGRAM",
    );
  });

  it("always forces System Administrators to the original Advisio theme", () => {
    expect(
      effectiveColorThemePreference("COLLEGE_PROGRAM", ["SYSTEM_ADMIN"]),
    ).toBe("DEFAULT_ADVISIO");
  });
});
