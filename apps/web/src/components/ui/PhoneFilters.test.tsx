// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhoneFilters } from "./PhoneFilters";

let host: HTMLDivElement;
let root: Root;

function setViewport(isPhone: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isPhone,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function show(element: React.ReactElement) {
  act(() => root.render(element));
}

function click(name: RegExp) {
  const button = Array.from(document.querySelectorAll("button")).find((item) => name.test(item.textContent ?? ""));
  if (!button) throw new Error(`No button named ${name}`);
  act(() => button.click());
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("PhoneFilters", () => {
  it("renders its fields directly above phone width", () => {
    setViewport(false);
    show(<PhoneFilters><select aria-label="Status" /></PhoneFilters>);
    expect(host.innerHTML).toBe('<select aria-label="Status"></select>');
  });

  it("moves its fields behind one button on phones", () => {
    setViewport(true);
    show(<PhoneFilters activeCount={2}><select aria-label="Status" /></PhoneFilters>);
    expect(document.querySelector('select[aria-label="Status"]')).toBeNull();
    expect(host.querySelector("button")?.textContent).toContain("2");
    click(/Filters/);
    expect(document.querySelector('select[aria-label="Status"]')).not.toBeNull();
  });

  it("applies filters that only take effect on confirm", () => {
    setViewport(true);
    const onApply = vi.fn();
    show(<PhoneFilters onApply={onApply}><select aria-label="Status" /></PhoneFilters>);
    click(/Filters/);
    click(/Show results/);
    expect(onApply).toHaveBeenCalledOnce();
  });
});
