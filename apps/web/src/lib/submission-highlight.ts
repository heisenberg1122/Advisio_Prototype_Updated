export type HighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type SubmissionTextAnchor = {
  pageNumber: number;
  selectedText: string;
  rects: HighlightRect[];
};

// Coordinates are relative to the displayed page, including its intrinsic
// rotation/crop, so zoom, scrolling, device pixel ratio, and resizing don't move
// the highlight away from its passage on this immutable version.
export function normalizeHighlightRects(
  rects: Array<{ left: number; top: number; width: number; height: number }>,
  page: { left: number; top: number; width: number; height: number },
): HighlightRect[] {
  if (page.width <= 0 || page.height <= 0) return [];
  const unique = new Map<string, HighlightRect>();
  for (const rect of rects) {
    const left = Math.max(page.left, rect.left),
      top = Math.max(page.top, rect.top);
    const right = Math.min(page.left + page.width, rect.left + rect.width);
    const bottom = Math.min(page.top + page.height, rect.top + rect.height);
    if (right <= left || bottom <= top) continue;
    const normalized = {
      x: (left - page.left) / page.width,
      y: (top - page.top) / page.height,
      width: (right - left) / page.width,
      height: (bottom - top) / page.height,
    };
    unique.set(
      Object.values(normalized)
        .map((n) => n.toFixed(6))
        .join(":"),
      normalized,
    );
  }
  return [...unique.values()];
}

export function captureTextAnchor(
  selection: Selection | null,
  layer: HTMLElement,
  pageNumber: number,
  page: HTMLElement,
): SubmissionTextAnchor | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1)
    return null;
  const range = selection.getRangeAt(0);
  if (
    !layer.contains(range.startContainer) ||
    !layer.contains(range.endContainer)
  )
    return null;
  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length > 5000) return null;
  const rects = normalizeHighlightRects(
    Array.from(range.getClientRects()),
    page.getBoundingClientRect(),
  );
  if (!rects.length || rects.length > 100) return null;
  return { pageNumber, selectedText, rects };
}
