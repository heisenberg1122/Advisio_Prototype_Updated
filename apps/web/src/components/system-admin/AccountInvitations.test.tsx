import { beforeEach, describe, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({
  states: [] as any[],
  index: 0,
  post: vi.fn(),
  invalidate: vi.fn(),
  preview: undefined as any,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: any) => {
    const index = harness.index++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [
      harness.states[index],
      (value: any) => {
        harness.states[index] =
          typeof value === "function" ? value(harness.states[index]) : value;
      },
    ];
  },
  useCallback: (callback: any) => callback,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: harness.invalidate }),
  useQuery: () => ({ data: harness.preview, isPending: false }),
}));
vi.mock("@/lib/api-client", () => ({ apiClient: { post: harness.post } }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, logout: vi.fn(), switchCollege: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({
    pathname: "/accept-invitation",
    hash: `#token=${"a".repeat(64)}`,
  }),
  useNavigate: () => vi.fn(),
  Link: "a",
}));
import { InviteAccountDialog } from "./AccountInvitations";
import AcceptInvitationPage from "@/app/(public)/accept-invitation/page";
const collegeId = "a0000000-0000-4000-8000-000000000001";
const user = {
  id: "existing",
  email: "existing@example.edu",
  universityId: "EXISTING-1",
  firstName: "Existing",
  lastName: "Faculty",
};
const nodes = (tree: any): any[] =>
  !tree || typeof tree !== "object"
    ? []
    : Array.isArray(tree)
      ? tree.flatMap(nodes)
      : [tree, ...nodes(tree.props?.children)];
function find(tree: any, predicate: (node: any) => boolean) {
  const node = nodes(tree).find(predicate);
  if (!node) throw new Error("Missing element");
  return node;
}
const props = () => ({
  users: [user],
  colleges: [{ id: collegeId, name: "College of Technology" }],
  onClose: vi.fn(),
  onSent: vi.fn(),
  onManageExisting: vi.fn(),
});
const render = (input: ReturnType<typeof props>) => {
  harness.index = 0;
  return InviteAccountDialog(input);
};
const renderAccept = () => {
  harness.index = 0;
  return AcceptInvitationPage();
};
beforeEach(() => {
  harness.states = [];
  harness.index = 0;
  vi.clearAllMocks();
  harness.invalidate.mockResolvedValue(undefined);
  harness.preview = {
    invitation: {
      email: "invited@example.edu",
      firstName: "Invited",
      roleNames: ["DEAN"],
      collegeName: "College of Technology",
      expiresAt: "2026-11-03T00:00:00Z",
      accountExists: false,
    },
  };
});
describe("account invitation forms", () => {
  it("offers existing role review and requires verified invitation details before adding access", async () => {
    const input = props();
    harness.states = [
      {
        email: "EXISTING@example.edu",
        universityId: "",
        firstName: "",
        lastName: "",
        collegeId: "",
        verificationNote: "",
      },
      [],
      false,
      false,
      "",
    ];
    const tree = render(input);
    find(
      tree,
      (node) => node.props?.children === "Review existing account roles",
    ).props.onClick();
    expect(input.onManageExisting).toHaveBeenCalledWith(user.id);
    await find(tree, (node) => node.type === "form").props.onSubmit({
      preventDefault() {},
    });
    expect(harness.post).not.toHaveBeenCalled();
  });
  it("sends verified fields and keeps errors visible when delivery fails", async () => {
    const input = props();
    harness.states = [
      {
        email: "new@example.edu",
        universityId: "NEW-1",
        firstName: "New",
        lastName: "Faculty",
        collegeId,
        verificationNote: "Appointment verified",
      },
      ["PANELIST"],
      true,
      false,
      "",
    ];
    harness.post.mockRejectedValueOnce(new Error("Email delivery unavailable"));
    await find(render(input), (node) => node.type === "form").props.onSubmit({
      preventDefault() {},
    });
    expect(harness.post).toHaveBeenCalledWith(
      "/api/account-invitations",
      expect.objectContaining({
        roleNames: ["PANELIST"],
        verificationConfirmed: true,
      }),
    );
    expect(
      nodes(render(input)).some(
        (node) =>
          node.props?.role === "alert" &&
          node.props.children === "Email delivery unavailable",
      ),
    ).toBe(true);
    expect(input.onSent).not.toHaveBeenCalled();
  });
  it("does not submit mismatched invitation passwords", async () => {
    harness.states = [
      "A unique secure password",
      "Different secure password",
      false,
      "",
      false,
    ];
    await find(renderAccept(), (node) => node.type === "form").props.onSubmit({
      preventDefault() {},
    });
    expect(harness.post).not.toHaveBeenCalled();
    expect(
      nodes(renderAccept()).some(
        (node) =>
          node.props?.role === "alert" &&
          node.props.children === "Passwords must match.",
      ),
    ).toBe(true);
  });
  it("prevents password setup if the email already has an account", () => {
    harness.preview.invitation.accountExists = true;
    expect(nodes(renderAccept()).some((node) => node.type === "form")).toBe(
      false,
    );
    expect(
      nodes(renderAccept()).some(
        (node) => node.props?.children === "Sign in to accept this invitation",
      ),
    ).toBe(true);
  });
});
