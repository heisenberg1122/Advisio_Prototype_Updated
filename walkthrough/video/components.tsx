import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Caption, CaptureEvent } from "./types";
import { cameraScale, easeInOut, type CameraMode } from "./motion";

export const theme = {
  navy: "#123752",
  gold: "#e7b454",
  paper: "#f3f6f8",
  ink: "#122e43",
};
export function CameraFrame({
  children,
  mode = "overview",
  focus,
}: {
  children: React.ReactNode;
  mode?: CameraMode;
  focus?: { x: number; y: number };
}) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig(),
    target = cameraScale[mode];
  const amount = interpolate(frame, [fps, fps * 1.35], [1, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let x = focus?.x ?? 960,
    y = focus?.y ?? 540;
  const halfWidth = 1920 / amount / 2,
    halfHeight = 1080 / amount / 2;
  x = Math.max(halfWidth, Math.min(1920 - halfWidth, x));
  y = Math.max(halfHeight, Math.min(1080 - halfHeight, y));
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        transformOrigin: "top left",
        transform: `translate(${960 - amount * x}px, ${540 - amount * y}px) scale(${amount})`,
      }}
    >
      {children}
    </div>
  );
}
export function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 240,
        top: 100,
        width: 1440,
        height: 840,
        borderRadius: 14,
        overflow: "hidden",
        background: "white",
        boxShadow: "0 18px 60px #102d4522",
      }}
    >
      <div
        style={{
          height: 30,
          background: "#e7edf2",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          gap: 9,
          color: "#496175",
          fontSize: 15,
        }}
      >
        <span aria-hidden>● ● ●</span>
        <span style={{ margin: "auto" }}>ADVISIO · Researcher workspace</span>
      </div>
      {/* Product capture is scaled uniformly, never rebuilt as a mock application. */}
      <div
        style={{
          width: 1920,
          height: 1080,
          overflow: "hidden",
          transform: "scale(0.75)",
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
export function ChapterLabel({
  index,
  title,
}: {
  index: number;
  title: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 32,
        left: 80,
        right: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color: theme.navy,
      }}
    >
      <strong style={{ fontSize: 28, letterSpacing: 1 }}>ADVISIO</strong>
      <span style={{ fontSize: 25 }}>
        {String(index).padStart(2, "0")} · {title}
      </span>
    </div>
  );
}
export function FeatureCallout({ text }: { text: string }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: 68,
        left: 80,
        fontSize: 21,
        color: "#4a6375",
        opacity: interpolate(frame, [0, 8], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      {text}
    </div>
  );
}
export function Spotlight({ event }: { event?: CaptureEvent }) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  if (!event) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: event.box.x - 6,
        top: event.box.y - 6,
        width: event.box.width + 12,
        height: event.box.height + 12,
        opacity: interpolate(
          frame / fps,
          [event.at, event.clickAt, event.clickAt + 0.08, event.clickAt + 0.2],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        ),
        border: `2px solid ${theme.gold}`,
        borderRadius: 9,
        boxShadow: "0 0 0 9999px #102c440a",
        pointerEvents: "none",
      }}
    />
  );
}
export function DemoCursor({ events }: { events: CaptureEvent[] }) {
  const { fps } = useVideoConfig(),
    frame = useCurrentFrame(),
    now = frame / fps;
  const nextIndex = events.findIndex((event) => event.clickAt > now);
  const next = nextIndex < 0 ? events.at(-1) : events[nextIndex];
  if (!next) return null;
  const previous =
    nextIndex < 0
      ? next
      : events[nextIndex - 1] || { x: next.x - 70, y: next.y + 35 };
  const progress = Math.max(
    0,
    Math.min(1, (now - next.at) / Math.max(0.15, next.clickAt - next.at)),
  );
  const eased = easeInOut(progress);
  const x = previous.x + (next.x - previous.x) * eased,
    y = previous.y + (next.y - previous.y) * eased;
  const recent = [...events].reverse().find((event) => event.clickAt <= now);
  const ripple = recent ? (now - recent.clickAt) / 0.45 : 2;
  return (
    <>
      <svg
        style={{
          position: "absolute",
          left: x - 3,
          top: y - 3,
          width: 22,
          height: 27,
          filter: "drop-shadow(0 1px 2px #0008)",
        }}
        viewBox="0 0 30 36"
      >
        <path
          d="M3 2 L4 29 L11 22 L17 34 L22 31 L16 20 L27 19 Z"
          fill="white"
          stroke={theme.navy}
          strokeWidth="2"
        />
      </svg>
      {recent && <ClickRipple x={recent.x} y={recent.y} progress={ripple} />}
    </>
  );
}
export function ClickRipple({
  x,
  y,
  progress,
}: {
  x: number;
  y: number;
  progress: number;
}) {
  if (progress < 0 || progress > 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 14,
        top: y - 14,
        width: 28,
        height: 28,
        border: `2px solid ${theme.gold}`,
        borderRadius: "50%",
        transform: `scale(${0.5 + progress * 0.5})`,
        opacity: 1 - progress,
        pointerEvents: "none",
      }}
    />
  );
}
export function CaptionLayer({ captions }: { captions: Caption[] }) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const caption = captions.find(
    (item) =>
      (frame / fps) * 1000 >= item.startMs && (frame / fps) * 1000 < item.endMs,
  );
  return caption ? (
    <div
      style={{
        position: "absolute",
        bottom: 44,
        left: 80,
        right: 80,
        textAlign: "center",
        whiteSpace: "pre-line",
        color: "white",
        fontSize: 38,
        lineHeight: 1.26,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          background: theme.ink,
          boxDecorationBreak: "clone",
          padding: "7px 22px",
          borderRadius: 8,
        }}
      >
        {caption.text}
      </span>
    </div>
  ) : null;
}
export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 6,
        background: "#dce5ec",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: theme.gold,
        }}
      />
    </div>
  );
}
export function IntroScene({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: 150,
        color: theme.navy,
        opacity: interpolate(frame, [0, 12], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div
        style={{
          width: 72,
          height: 5,
          background: theme.gold,
          marginBottom: 30,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <Img
          src={staticFile("branding/advisio-logo.png")}
          alt="ADVISIO logo"
          style={{ width: 128, height: 102, objectFit: "contain" }}
        />
        <p style={{ fontSize: 34, letterSpacing: 5 }}>ADVISIO</p>
      </div>
      <h1
        style={{
          fontSize: 76,
          maxWidth: 1400,
          lineHeight: 1.12,
          margin: "10px 0 32px",
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: 28, maxWidth: 1200, lineHeight: 1.5 }}>
        {subtitle}
      </p>
    </AbsoluteFill>
  );
}
export const OutroScene = () => (
  <IntroScene
    title="Researcher Walkthrough Complete"
    subtitle="You’re ready to explore the Researcher workspace. Return to any section for a refresher."
  />
);
