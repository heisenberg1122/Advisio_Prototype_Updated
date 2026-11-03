// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

let host: HTMLDivElement;
let root: Root;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function flushFrames() {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
}

function Form({ open = true, onClose = () => {} }: {
  open?: boolean;
  onClose?: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Modal isOpen={open} title="Edit details" onClose={() => onClose(value)}>
      <input aria-label="Title" value={value} onChange={(event) => setValue(event.target.value)} />
      <button>Save</button>
    </Modal>
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  frames = new Map();
  nextFrame = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  document.body.style.overflow = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Modal focus lifecycle", () => {
  it("keeps input focus through consecutive edits with an inline close callback", () => {
    act(() => root.render(<Form />));
    flushFrames();
    const input = host.querySelector("input")!;
    input.focus();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

    for (const value of ["a", "ab", "abc"]) {
      act(() => {
        setValue.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      flushFrames();
      expect(input.value).toBe(value);
      expect(document.activeElement).toBe(input);
      expect(host.querySelector("input")).toBe(input);
    }
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("uses the latest close callback for Escape without resetting focus", () => {
    const oldClose = vi.fn();
    const latestClose = vi.fn();
    act(() => root.render(<Form onClose={oldClose} />));
    flushFrames();
    const input = host.querySelector("input")!;
    input.focus();
    act(() => root.render(<Form onClose={latestClose} />));
    flushFrames();
    expect(document.activeElement).toBe(input);
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(oldClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();
  });

  it("restores focus and scrolling when the dialog closes", () => {
    const opener = document.createElement("button");
    document.body.prepend(opener);
    opener.focus();
    document.body.style.overflow = "auto";
    act(() => root.render(<Form />));
    flushFrames();
    expect(document.body.style.overflow).toBe("hidden");
    act(() => root.render(<Form open={false} />));
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("auto");
  });

  it("still traps Tab in the dialog", () => {
    act(() => root.render(<Form />));
    flushFrames();
    const buttons = host.querySelectorAll("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    expect(document.activeElement).toBe(first);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
  });

  it("cancels pending opening focus when closed before the next frame", () => {
    act(() => root.render(<Form />));
    expect(frames.size).toBe(1);
    act(() => root.render(<Form open={false} />));
    expect(frames.size).toBe(0);
    expect(window.cancelAnimationFrame).toHaveBeenCalledOnce();
  });
});
