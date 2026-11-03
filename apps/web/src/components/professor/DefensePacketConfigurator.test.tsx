// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  packet: {
    packet: {
      evaluationMode: "RUBRIC",
      recommendationTemplateVersionId: "recommendation-template",
      evaluationTemplateVersionId: "evaluation-template",
      recommendationFieldMappings: [{ key: "panelistName" }],
      evaluationFieldMappings: [{ key: "totalScore" }],
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0].startsWith("defense-packet") ? fixtures.packet : undefined,
    isPending: false,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("./SubmittedPdfEvaluations", () => ({ SubmittedPdfEvaluations: () => null }));
vi.mock("./StructuredDefensePacket", () => ({ StructuredDefensePacket: () => null }));
vi.mock("@/components/documents/SharedManuscriptFeedback", () => ({ SharedManuscriptFeedback: () => null }));

import { DefensePacketConfigurator } from "./DefensePacketConfigurator";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(
    <DefensePacketConfigurator session={{ id: "session", research: {} }} onClose={() => {}} onSaved={() => {}} />,
  ));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("legacy defense PDF mapping focus", () => {
  it.each(["recommendation", "evaluation"])("keeps the %s mapping input mounted and focused while editing", (kind) => {
    const section = [...host.querySelectorAll("section")].find((element) =>
      element.querySelector("h3")?.textContent === `Set up the ${kind} PDF`,
    )!;
    const input = section.querySelector<HTMLInputElement>('input[type="number"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    input.focus();
    for (const value of ["2", "23", "234"]) {
      act(() => {
        setValue.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(host.contains(input)).toBe(true);
      expect(document.activeElement).toBe(input);
      expect(section.querySelector('input[type="number"]')).toBe(input);
      expect(input.value).toBe(value);
    }
  });
});
