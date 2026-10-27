import React from "react";
import { renderToReadableStream } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./routes";

const session = vi.hoisted(() => ({
  user: { id: "researcher", roles: ["RESEARCHER"] },
  isLoading: false,
  isAuthenticated: true,
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => session }));
vi.mock("./app/student/layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <section data-researcher-layout>{children}</section>
  ),
}));
// SSR does not execute Navigate's effect. Capture its requested destination while
// keeping the real Routes matcher, protection, query hooks and join page.
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  Navigate: (props: unknown) => {
    navigate(props);
    return null;
  },
}));

async function renderRoute(url: string) {
  const stream = await renderToReadableStream(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await stream.allReady;
  return new Response(stream).text();
}

beforeEach(() => {
  navigate.mockClear();
  session.isAuthenticated = true;
  session.user.roles = ["RESEARCHER"];
});

describe("research team join routes", () => {
  it("renders the existing join page in the researcher layout at the canonical route", async () => {
    const html = await renderRoute("/student/join-group");
    expect(html).toContain("data-researcher-layout");
    expect(html).toContain("Join Research Team");
    expect(html).toContain('placeholder="ENTER GROUP CODE"');
    expect(html).toContain("Review group");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("prefills the query code on the canonical page", async () => {
    const html = await renderRoute("/student/join-group?code=ABC123");
    expect(html).toContain('value="ABC123"');
  });

  it.each([
    "",
    "?code=TEAM123",
    "?code=TEAM123&context=team%20invite&extra=1&extra=2#join",
  ])(
    "redirects old invitations without changing query/hash context: %s",
    async (suffix) => {
      await renderRoute(`/join-group${suffix}`);
      expect(navigate).toHaveBeenCalledWith({
        to: `/student/join-group${suffix}`,
        replace: true,
      });
    },
  );

  it("preserves the canonical invitation as the return location when sign-in is required", async () => {
    session.isAuthenticated = false;
    const html = await renderRoute("/student/join-group?code=ABC123");
    expect(html).not.toContain("Join Research Team");
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/login",
        state: {
          from: expect.objectContaining({
            pathname: "/student/join-group",
            search: "?code=ABC123",
          }),
        },
      }),
    );
  });

  it("keeps non-researcher roles outside the protected join page", async () => {
    session.user.roles = ["ADVISER"];
    const html = await renderRoute("/student/join-group?code=ABC123");
    expect(html).not.toContain("Join Research Team");
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/adviser/dashboard" }),
    );
  });
});
