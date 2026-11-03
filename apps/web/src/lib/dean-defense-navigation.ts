import { isSafeInternalUrl } from "@research-management/auth";

export function deanDefenseReturn(
  value: string | null,
  roles: string[] | undefined,
) {
  if (
    !value ||
    !roles?.some((role) => role === "DEAN" || role === "SYSTEM_ADMIN") ||
    !isSafeInternalUrl(value)
  )
    return null;
  const url = new URL(value, "https://advisio.invalid");
  return url.origin === "https://advisio.invalid" &&
    url.pathname === "/admin/dashboard" &&
    url.searchParams.get("tab") === "defenses"
    ? `${url.pathname}${url.search}`
    : null;
}
