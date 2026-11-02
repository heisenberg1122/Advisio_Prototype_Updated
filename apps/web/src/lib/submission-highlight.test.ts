import { describe, expect, it } from "vitest";
import {
  captureTextAnchor,
  normalizeHighlightRects,
} from "./submission-highlight";

describe("PDF passage anchors", () => {
  it("preserves page-relative positions across zoom, scrolling, and pixel sizes", () => {
    const original = normalizeHighlightRects(
      [{ left: 120, top: 240, width: 160, height: 20 }],
      { left: 100, top: 200, width: 800, height: 1000 },
    );
    const zoomed = normalizeHighlightRects(
      [{ left: 90, top: 180, width: 320, height: 40 }],
      { left: 50, top: 100, width: 1600, height: 2000 },
    );
    expect(original).toEqual(zoomed);
    expect(original[0]).toEqual({
      x: 0.025,
      y: 0.04,
      width: 0.2,
      height: 0.02,
    });
  });
  it("clips rectangles to the page and deduplicates nested text ranges", () => {
    const rect = { left: -10, top: 20, width: 50, height: 10 };
    expect(
      normalizeHighlightRects(
        [rect, rect, { left: 150, top: 50, width: 20, height: 10 }],
        { left: 0, top: 0, width: 100, height: 100 },
      ),
    ).toEqual([{ x: 0, y: 0.2, width: 0.4, height: 0.1 }]);
  });
  it("retains separate rectangles for a passage spanning lines", () => {
    expect(
      normalizeHighlightRects(
        [
          { left: 10, top: 20, width: 70, height: 10 },
          { left: 10, top: 32, width: 40, height: 10 },
        ],
        { left: 0, top: 0, width: 100, height: 100 },
      ),
    ).toHaveLength(2);
  });
  it("rejects a selection that starts or ends outside this PDF page", () => {
    const selection = {
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => ({
        startContainer: "document",
        endContainer: "sidebar",
      }),
    } as any;
    expect(
      captureTextAnchor(
        selection,
        { contains: (node) => node === "document" } as any,
        1,
        {} as any,
      ),
    ).toBeNull();
  });
  it("does not create anchors for empty or collapsed selections", () => {
    expect(captureTextAnchor(null, {} as any, 1, {} as any)).toBeNull();
    expect(
      captureTextAnchor({ isCollapsed: true } as any, {} as any, 1, {} as any),
    ).toBeNull();
    expect(
      normalizeHighlightRects([], { left: 0, top: 0, width: 0, height: 0 }),
    ).toEqual([]);
  });
});
