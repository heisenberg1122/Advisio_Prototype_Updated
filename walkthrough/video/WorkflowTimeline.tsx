import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./components";

const stages = [
  ["Topic and scope preparation", "Completed"],
  ["Requirements and system design review", "Current stage · Review required"],
  ["Proposal defense", "Upcoming"],
  ["Research preparation clearance", "Upcoming"],
];
// This is an explanatory annotation, never a fabricated transition in product data.
export function WorkflowTimeline() {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig(),
    seconds = frame / fps;
  const opacity = interpolate(seconds, [0, 0.35, 11.4, 12], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const growth = interpolate(seconds, [0.4, 2.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 520,
        top: 140,
        width: 880,
        padding: 44,
        background: "#fffffff7",
        border: "1px solid #d8e2e9",
        boxShadow: "0 12px 34px #12375218",
        borderRadius: 18,
        opacity,
      }}
    >
      <p
        style={{
          fontSize: 18,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#526b7f",
          margin: 0,
        }}
      >
        Workflow relationship · Illustrated example
      </p>
      <h2 style={{ fontSize: 34, color: theme.navy, margin: "12px 0 24px" }}>
        A configured sequence of requirements
      </h2>
      <div style={{ position: "relative" }}>
        <svg
          style={{
            position: "absolute",
            left: 15,
            top: 22,
            width: 4,
            height: 350,
          }}
        >
          <line
            x1="2"
            x2="2"
            y1="0"
            y2="350"
            stroke="#d9e2e9"
            strokeWidth="3"
          />
          <line
            x1="2"
            x2="2"
            y1="0"
            y2={350 * growth}
            stroke={theme.gold}
            strokeWidth="3"
          />
        </svg>
        {stages.map(([name, state], index) => (
          <div
            key={name}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "start",
              gap: 22,
              minHeight: 112,
              opacity: interpolate(
                seconds,
                [0.3 + index * 0.5, 0.65 + index * 0.5],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                display: "grid",
                placeItems: "center",
                borderRadius: "50%",
                background: index < 2 ? theme.navy : "#e7edf2",
                color: index < 2 ? "white" : "#526b7f",
                fontSize: 18,
              }}
            >
              {index === 0 ? "✓" : index + 1}
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 25, color: theme.navy }}>
                {name}
              </strong>
              <p style={{ fontSize: 20, margin: "9px 0", color: "#526b7f" }}>
                {state}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 21, color: theme.navy, margin: "8px 0 0" }}>
        Submission → Faculty review → Revision when requested → Resubmission
      </p>
    </div>
  );
}
