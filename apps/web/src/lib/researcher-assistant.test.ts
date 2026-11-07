// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  assistantActionId,
  resolveAssistantAction,
  resolveAssistantQuestion,
} from "@research-management/shared/src/researcher-assistant";
import {
  assistantPreferenceKey,
  readAssistantPreference,
  saveAssistantPreference,
} from "./assistant-preference";
const permissions = ["research.view", "research.submit", "document.view"];

describe("Confident Researcher help matching", () => {
  it.each([
    ["Where are my project details?", "project"],
    ["Where is my group?", "group"],
    ["I can't find my group's members.", "group"],
    ["How do I join a class?", "class"],
    ["How do I join a research group?", "join-group"],
    ["Where are my tasks?", "tasks"],
    ["How do I see my grades?", "grades"],
    ["dark mode", "theme"],
    ["submission history", "history"],
    ["Paano sumali sa klase?", "class"],
    ["Saan ko makikita ang kagrupo ko?", "group"],
    ["Paano magpasa ng work?", "submit"],
    ["Saan ang grades ko?", "grades"],
    ["Paano palitan ang dark mode?", "theme"],
    ["Saan ang documents?", "documents"],
  ])("resolves %s without AI", (message, id) => {
    const result = resolveAssistantQuestion(message, permissions);
    expect(result.kind).toBe("local");
    if (result.kind === "local") expect(result.topic.id).toBe(id);
  });
  it("sends multiple distinct intents and low-confidence questions for grounded explanation", () => {
    expect(
      resolveAssistantQuestion(
        "How do I join a class and join a research group?",
        permissions,
      ).kind,
    ).toBe("ai");
    expect(
      resolveAssistantQuestion(
        "Why is my submission still unavailable?",
        permissions,
      ).kind,
    ).toBe("ai");
    expect(
      resolveAssistantQuestion(
        "Please interpret this unusual issue.",
        permissions,
      ).kind,
    ).toBe("ai");
  });
  it("uses a trusted previous topic for short follow-ups", () => {
    const result = resolveAssistantQuestion("show me", permissions, "group");
    expect(result.kind === "local" && result.topic.id).toBe("group");
  });
  it("resolves navigation only from registered and authorized action IDs", () => {
    expect(
      resolveAssistantAction(
        assistantActionId("group", "navigate"),
        permissions,
      )?.topic.href,
    ).toBe("/student/dashboard?tab=group&section=my-group");
    expect(
      resolveAssistantAction("https://untrusted.test:navigate", permissions),
    ).toBeNull();
    expect(resolveAssistantAction("group:delete", permissions)).toBeNull();
    expect(resolveAssistantAction("documents:navigate", [])).toBeNull();
    expect(
      resolveAssistantAction("group:navigate:extra", permissions),
    ).toBeNull();
  });
});

describe("Account-scoped assistant visibility", () => {
  afterEach(() => localStorage.clear());
  it("defaults on for a new account and never overwrites an explicit OFF", () => {
    expect(readAssistantPreference("new-user")).toBe(true);
    expect(localStorage.getItem(assistantPreferenceKey("new-user"))).toBeNull();
    saveAssistantPreference("new-user", false);
    expect(readAssistantPreference("new-user")).toBe(false);
    expect(localStorage.getItem(assistantPreferenceKey("new-user"))).toBe(
      "false",
    );
  });
  it("preserves ON/OFF independently for different users", () => {
    saveAssistantPreference("alice", false);
    saveAssistantPreference("bob", true);
    expect(readAssistantPreference("alice")).toBe(false);
    expect(readAssistantPreference("bob")).toBe(true);
    saveAssistantPreference("alice", true);
    expect(readAssistantPreference("alice")).toBe(true);
    expect(readAssistantPreference()).toBe(false);
  });
});
