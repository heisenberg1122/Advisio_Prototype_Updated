import { Moon, Sun } from "lucide-react";
import type { LandingTheme } from "./useLandingTheme";

export function LandingThemeToggle({
  theme,
  onToggle,
}: {
  theme: LandingTheme;
  onToggle: (button: HTMLElement) => void;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="lp-theme-toggle"
      onClick={(event) => onToggle(event.currentTarget)}
      aria-label="Dark mode"
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <Sun size={18} strokeWidth={1.6} aria-hidden="true" />
      ) : (
        <Moon size={18} strokeWidth={1.6} aria-hidden="true" />
      )}
    </button>
  );
}
