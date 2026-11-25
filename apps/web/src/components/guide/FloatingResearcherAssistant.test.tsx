// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { FloatingResearcherAssistant } from "./FloatingResearcherAssistant";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: { post }, ApiError: Error }));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "researcher", permissions: ["research.view"] },
  }),
}));
vi.mock("@/providers/researcher-guide-provider", () => ({
  useResearcherGuide: () => ({ enabled: true, workspace: "researcher" }),
}));
vi.mock("@/lib/assistant-preference", () => ({
  useAssistantVisibility: () => ({ visible: true }),
}));

function button(label: string) {
  const result = [...document.querySelectorAll("button")].find(
    (element) =>
      element.textContent?.trim() === label ||
      element.getAttribute("aria-label") === label,
  );
  expect(result).toBeDefined();
  return result!;
}

it.each([
  {
    language: "en",
    original: "Open the Guide.",
    translated: "Buksan ang Guide.",
    target: "tl",
    label: "Translate to Tagalog",
  },
  {
    language: "tl",
    original: "Buksan ang Guide.",
    translated: "Open the Guide.",
    target: "en",
    label: "Translate to English",
  },
])(
  "translates an AI reply from $language on demand and reuses the translation",
  async ({ language, original, translated, target, label }) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    post
      .mockReset()
      .mockResolvedValueOnce({
        source: "fallback",
        text: "Enable Groq.",
        topicIds: [],
        needsConsent: true,
        consentProvider: "groq",
      })
      .mockResolvedValueOnce({
        source: "ai",
        text: original,
        topicIds: [],
        language,
      })
      .mockResolvedValueOnce({ text: translated });
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <MemoryRouter>
            <FloatingResearcherAssistant />
          </MemoryRouter>,
        ),
      );
      await act(async () => button("Open Advisio Assistant").click());
      await act(async () => button("How do I join a class?").click());
      await act(async () =>
        document
          .querySelector<HTMLInputElement>('input[type="checkbox"]')!
          .click(),
      );
      await act(async () => button("Ask with AI").click());
      expect(document.body.textContent).toContain(original);
      expect(post).toHaveBeenCalledTimes(2);

      await act(async () => button(label).click());
      expect(post.mock.calls[2][1]).toMatchObject({
        text: original,
        translateTo: target,
        aiProvider: "groq",
      });
      expect(document.body.textContent).toContain(translated);
      await act(async () => button("Show original").click());
      expect(document.body.textContent).toContain(original);
      await act(async () => button(label).click());
      expect(document.body.textContent).toContain(translated);
      expect(post).toHaveBeenCalledTimes(3);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  },
);
