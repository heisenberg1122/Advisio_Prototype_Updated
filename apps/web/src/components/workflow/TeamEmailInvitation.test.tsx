import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { TeamEmailInvitation } from "./TeamEmailInvitation";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ apiClient: { post: vi.fn() } }));
afterEach(() => vi.resetAllMocks());

describe("team invitation sender confirmation", () => {
  it.each(["workspace", "project"] as const)(
    "identifies notifications after a successful %s invitation",
    async (kind) => {
      const setMessage = vi.fn();
      const states = [
        ["researcher@example.test", vi.fn()],
        [false, vi.fn()],
        ["", setMessage],
      ];
      // Supply hook state to exercise the real async form submission without a DOM.
      vi.mocked(useState).mockImplementation(() => states.shift() as any);
      vi.mocked(apiClient.post).mockResolvedValue({ queued: 1 });
      const form = TeamEmailInvitation({ teamId: "team", kind });
      await form.props.onSubmit({ preventDefault: vi.fn() });
      expect(apiClient.post).toHaveBeenCalledWith(
        kind === "workspace"
          ? "/api/workspaces/team/invitations"
          : "/api/research/team/team-invitations",
        { email: "researcher@example.test" },
      );
      const message = setMessage.mock.calls.at(-1)![0];
      expect(message).toMatch(/invitation sent/i);
      expect(message).toMatch(/Advisio notifications/i);
      expect(message).not.toMatch(/inbox/i);
    },
  );
});
