import { describe, expect, it } from "vitest";
import {
  effectiveColorThemePreference,
  parseColorThemePreference,
  parseHeadingFontPreference,
} from "./appearance-preference.js";

describe("appearance preferences", () => {
  it("accepts the soft college theme", () => {
    expect(parseColorThemePreference("college_soft")).toBe("COLLEGE_SOFT");
  });

  it("keeps System Administrators on the original theme", () => {
    expect(effectiveColorThemePreference("COLLEGE_SOFT", ["SYSTEM_ADMIN"])).toBe("DEFAULT_ADVISIO");
  });

  it("accepts only known heading fonts", () => {
    expect(parseHeadingFontPreference("serif")).toBe("SERIF");
    expect(parseHeadingFontPreference("comic")).toBeNull();
  });
});
