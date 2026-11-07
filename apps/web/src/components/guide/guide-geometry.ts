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
export function connectedGuideGeometry(
  target: GuideRect,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const gap = 22,
    edge = 12;
  const above = target.top - gap - edge;
  const below = viewport.height - target.bottom - gap - edge;
  let left: number, top: number;
  let side: "left" | "right" | "top" | "bottom";
  if (viewport.width - target.right >= tooltip.width + gap + edge) {
    side = "right";
    left = target.right + gap;
    top = target.top + (target.height - tooltip.height) / 2;
  } else if (target.left >= tooltip.width + gap + edge) {
    side = "left";
    left = target.left - tooltip.width - gap;
    top = target.top + (target.height - tooltip.height) / 2;
  } else if (below >= tooltip.height || below > above) {
    side = "bottom";
    left = target.left;
    top = target.bottom + gap;
  } else {
    side = "top";
    left = target.left;
    top = target.top - Math.min(tooltip.height, Math.max(above, 120)) - gap;
  }
  const maxHeight =
    side === "top"
      ? Math.max(above, 120)
      : side === "bottom"
        ? Math.max(below, 120)
        : viewport.height - 2 * edge;
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
    end,
    path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
  };
}
