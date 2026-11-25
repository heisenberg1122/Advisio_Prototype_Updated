import type { CSSProperties } from "react";
import "./role-home.css";

export type ProgressTone = "attention" | "waiting" | "brand" | "done";

/** Colour for a completion percentage: red when far behind, green when complete. */
export function progressTone(value: number): ProgressTone {
  if (value >= 100) return "done";
  if (value < 25) return "attention";
  if (value < 50) return "waiting";
  return "brand";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ProgressRing({ value, tone = "brand" }: { value: number; tone?: ProgressTone }) {
  const percent = clamp(value);
  return (
    <span className="rh-dial" data-tone={tone} style={{ "--rh-progress": percent } as CSSProperties} aria-hidden="true">
      <b>{percent}%</b>
    </span>
  );
}

export function ProgressTrack({ value, tone = "brand", className }: { value: number; tone?: ProgressTone; className?: string }) {
  return (
    <span className={className ? `rh-track ${className}` : "rh-track"} aria-hidden="true">
      <i data-tone={tone} style={{ width: `${clamp(value)}%` }} />
    </span>
  );
}

export function MiniProgress({ value, tone }: { value: number; tone?: ProgressTone }) {
  return (
    <span className="rh-mini">
      <ProgressTrack value={value} tone={tone ?? progressTone(value)} />
      <b>{clamp(value)}%</b>
    </span>
  );
}
