import type { ColorThemePreference, HeadingFontPreference } from "./prisma.js";

export const COLOR_THEME_PREFERENCES = [
  "DEFAULT_ADVISIO",
  "COLLEGE_PROGRAM",
  "COLLEGE_SOFT",
] as const satisfies readonly ColorThemePreference[];

export const HEADING_FONT_PREFERENCES = [
  "STANDARD",
  "SERIF",
] as const satisfies readonly HeadingFontPreference[];

export function parseHeadingFontPreference(
  value: unknown,
): HeadingFontPreference | null {
  const normalized = String(value || "").trim().toUpperCase();
  return HEADING_FONT_PREFERENCES.includes(normalized as HeadingFontPreference)
    ? (normalized as HeadingFontPreference)
    : null;
}

export function parseColorThemePreference(
  value: unknown,
): ColorThemePreference | null {
  const normalized = String(value || "").trim().toUpperCase();
  return COLOR_THEME_PREFERENCES.includes(
    normalized as ColorThemePreference,
  )
    ? (normalized as ColorThemePreference)
    : null;
}

export function effectiveColorThemePreference(
  preference: ColorThemePreference,
  roles: readonly string[],
): ColorThemePreference {
  return roles.includes("SYSTEM_ADMIN") ? "DEFAULT_ADVISIO" : preference;
}
