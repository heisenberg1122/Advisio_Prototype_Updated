import { useId } from "react";
import type { guidePlacement } from "./guide-geometry";

export function GuideConnector({
  connector,
  viewport,
}: {
  connector: NonNullable<ReturnType<typeof guidePlacement>["connector"]>;
  viewport: { width: number; height: number };
}) {
  const marker = "guide-arrow-" + useId().replace(/[^a-z0-9]/gi, "");
  return (
    <svg
      className="researcher-guide-walkthrough__connector"
      aria-hidden="true"
      width={viewport.width}
      height={viewport.height}
    >
      <defs>
        <marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="currentColor" />
        </marker>
      </defs>
      <path
        data-guide-connector="true"
        data-target-x={connector.end.x}
        data-target-y={connector.end.y}
        d={connector.path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        markerEnd={`url(#${marker})`}
      />
    </svg>
  );
}
