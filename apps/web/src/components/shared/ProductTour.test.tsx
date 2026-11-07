// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ProductTour } from "./ProductTour";
import type { GuidedStep } from "@/lib/workspace-tours";

let host: HTMLElement, root: Root, frames: Map<number, FrameRequestCallback>, frameId: number, clock: number;
const next = vi.fn(), close = vi.fn(), back = vi.fn(), retry = vi.fn();
const step: GuidedStep = { href: "/student/tasks", title: "Check a requirement", content: "Read the instructions before preparing your submission.", target: "example" };
function flush() { act(() => { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback(clock)); }); }
function render(value = step, routeReady = true) { act(() => root.render(<ProductTour step={value} index={0} total={3} routeReady={routeReady} onNext={next} onClose={close} onBack={back} onRetry={retry} />)); }
function addTarget() {
  const target = document.createElement("div"); target.dataset.tour = "example";
  target.getClientRects = () => [{ top: 100, left: 100, width: 200, height: 44, right: 300, bottom: 144 }] as unknown as DOMRectList;
  target.getBoundingClientRect = () => ({ top: 100, left: 100, width: 200, height: 44, right: 300, bottom: 144, x: 100, y: 100, toJSON: () => ({}) });
  document.body.append(target); return target;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  clock = 0; frames = new Map(); frameId = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.set(++frameId, callback); return frameId; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id); });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(() => { act(() => root.unmount()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("ProductTour safe interaction lifecycle", () => {
  it("waits for a real target on the correct route before enabling Next", () => {
    addTarget(); render(step, false); flush();
    expect(document.querySelector("[data-tour-spotlight]")).toBeNull();
    expect([...document.querySelectorAll("button")].find(button => button.textContent === "Next")?.disabled).toBe(true);
    render(step, true); flush();
    expect(document.querySelector("[data-tour-spotlight]")).not.toBeNull();
    expect((document.activeElement as HTMLElement).textContent).toBe("Next");
    expect(next).not.toHaveBeenCalled();
  });
  it("finds delayed targets without navigating, clicking, or advancing automatically", () => {
    render(); flush(); expect(document.querySelector("[data-tour-spotlight]")).toBeNull();
    const target = addTarget(); const click = vi.fn(); target.addEventListener("click", click);
    flush(); expect(document.querySelector("[data-tour-spotlight]")).not.toBeNull();
    expect(click).not.toHaveBeenCalled(); expect(next).not.toHaveBeenCalled();
  });
  it("offers explicit recovery and reports a skipped step as incomplete", () => {
    render(); flush(); clock = 9000; flush();
    expect(document.body.textContent).toContain("unavailable");
    const skip = [...document.querySelectorAll("button")].find(button => button.textContent === "Skip step")!;
    act(() => skip.click()); expect(next).toHaveBeenCalledWith(false);
    const retryButton = [...document.querySelectorAll("button")].find(button => button.textContent === "Retry")!;
    act(() => retryButton.click()); expect(retry).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-tour-spotlight]")).toBeNull();
  });
  it("keeps consequential page inputs outside the keyboard cycle", () => {
    const target = addTarget(); const input = document.createElement("input"); target.append(input);
    render(); flush();
    for (let i = 0; i < 8; i++) {
      act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true })));
      expect(document.activeElement).not.toBe(input);
    }
    expect((document.querySelector(".product-tour__spotlight") as HTMLElement).style.pointerEvents).toBe("auto");
  });
  it("exposes only an explicitly safe highlighted control and exits with Escape", () => {
    const target = addTarget(); const select = document.createElement("select"); select.append(document.createElement("option"));
    select.getClientRects = target.getClientRects; target.append(select);
    render({ ...step, interactive: true }); flush();
    expect((document.querySelector(".product-tour__spotlight") as HTMLElement).style.pointerEvents).toBe("none");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true })));
    expect(document.activeElement).toBe(select);
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true })));
    expect(close).toHaveBeenCalledOnce(); expect(next).not.toHaveBeenCalled();
  });
});
