export interface GuideRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(value, Math.max(low, high)));
export function guidePlacement(
  target: GuideRect | null,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
  preferVertical = false,
) {
  const gap = 22,
    edge = 12;
  const viewportHeight = Math.max(0, viewport.height - 2 * edge);
  const centered = (viewport.width - tooltip.width) / 2;
  if (!target) {
    return {
      left: centered,
      top: Math.max(edge, viewport.height - tooltip.height - edge),
      maxHeight: viewportHeight,
      connector: null,
    };
  }
  const above = target.top - gap - edge;
  const below = viewport.height - target.bottom - gap - edge;
  const minimumHeight = 176;
  let left: number, top: number;
  let side: "left" | "right" | "top" | "bottom";
  let maxHeight = viewportHeight;
  if (
    !preferVertical &&
    viewport.width - target.right >= tooltip.width + gap + edge
  ) {
    side = "right";
    left = target.right + gap;
    top = target.top + (target.height - tooltip.height) / 2;
  } else if (!preferVertical && target.left >= tooltip.width + gap + edge) {
    side = "left";
    left = target.left - tooltip.width - gap;
    top = target.top + (target.height - tooltip.height) / 2;
  } else if (below >= minimumHeight && (below >= tooltip.height || below >= above)) {
    side = "bottom";
    left = target.left;
    top = target.bottom + gap;
    maxHeight = below;
  } else if (above >= minimumHeight) {
    side = "top";
    left = target.left;
    maxHeight = above;
    top = target.top - Math.min(tooltip.height, maxHeight) - gap;
  } else {
    // A short screen can leave no room for a readable box beside the highlight.
    const maxHeight = Math.min(
      viewportHeight,
      Math.floor(viewport.height * 0.45),
      Math.max(152, Math.floor(viewport.height / 3)),
    );
    const height = Math.min(tooltip.height, maxHeight);
    return {
      left: centered,
      top: below >= above ? viewport.height - height - edge : edge,
      maxHeight,
      connector: null,
    };
  }
  const height = Math.min(tooltip.height, maxHeight);
  left = clamp(left, edge, viewport.width - tooltip.width - edge);
  top = clamp(top, edge, viewport.height - height - edge);
  const middleX = target.left + target.width / 2,
    middleY = target.top + target.height / 2;
  const end =
    side === "right"
      ? { x: target.right + 5, y: middleY }
      : side === "left"
        ? { x: target.left - 5, y: middleY }
        : side === "bottom"
          ? { x: middleX, y: target.bottom + 5 }
          : { x: middleX, y: target.top - 5 };
  const start =
    side === "right"
      ? { x: left, y: clamp(middleY, top + 18, top + height - 18) }
      : side === "left"
        ? {
            x: left + tooltip.width,
            y: clamp(middleY, top + 18, top + height - 18),
          }
        : side === "bottom"
          ? { x: clamp(middleX, left + 18, left + tooltip.width - 18), y: top }
          : {
              x: clamp(middleX, left + 18, left + tooltip.width - 18),
              y: top + height,
            };
  return {
    left,
    top,
    maxHeight,
    connector: { end, path: `M ${start.x} ${start.y} L ${end.x} ${end.y}` },
  };
}
