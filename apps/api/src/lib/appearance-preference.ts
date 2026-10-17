import type { ColorThemePreference } from "./prisma.js";

export const COLOR_THEME_PREFERENCES = [
  "DEFAULT_ADVISIO",
  "COLLEGE_PROGRAM",
] as const satisfies readonly ColorThemePreference[];

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
