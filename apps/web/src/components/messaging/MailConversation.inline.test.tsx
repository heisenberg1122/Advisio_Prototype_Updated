import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { ComposeSeed, MailThread } from "./mail-types";

// Exercise editor state and callbacks without browser automation.
const harness = vi.hoisted(() => ({
  states: [] as any[],
  index: 0,
  portal: vi.fn((content: any) => content),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: any) => {
    const index = harness.index++;
    if (!(index in harness.states))
      harness.states[index] =
        typeof initial === "function" ? initial() : initial;
    return [
      harness.states[index],
      (value: any) => {
        harness.states[index] =
          typeof value === "function" ? value(harness.states[index]) : value;
      },
    ];
  },
  useRef: (current: any) => ({ current }),
  useEffect: () => {},
}));
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  createPortal: harness.portal,
}));
vi.mock("../workflow/WorkflowInvitationActions", () => ({
  WorkflowInvitationActions: () => null,
}));
import { MailComposeWindow } from "./MailComposeWindow";
import { MailConversation } from "./MailConversation";

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function find(tree: any, predicate: (node: any) => boolean) {
  const node = nodes(tree).find(predicate);
  if (!node) throw new Error("Expected element was not rendered");
  return node;
}
const byLabel = (tree: any, label: string) =>
  find(tree, (node) => node.props?.["aria-label"] === label);
const button = (tree: any, text: string) =>
  find(
    tree,
    (node) =>
      node.type === "button" && [node.props.children].flat().includes(text),
  );
const host = {} as HTMLDivElement;
const sender = {
  id: "sender",
  firstName: "Demo",
  lastName: "Coordinator",
  email: "coordinator@example.invalid",
};
const other = {
  id: "other",
  firstName: "Other",
  lastName: "Participant",
  email: "other@example.invalid",
};
const message = {
  id: "message",
  threadId: "thread-a",
  senderId: sender.id,
  body: "Original invitation",
  isDraft: false,
  createdAt: "2026-10-28T00:00:00Z",
  sender,
  attachments: [],
};
const thread: MailThread = {
  id: "thread-a",
  subject: "Workflow invitation",
  createdById: sender.id,
  createdAt: message.createdAt,
  updatedAt: message.createdAt,
  unread: false,
  messages: [message],
  participants: [sender, other].map((user) => ({
    threadId: "thread-a",
    userId: user.id,
    recipientType: "TO",
    user,
  })),
};
const seed: ComposeSeed = {
  key: "reply",
  inlineThreadId: thread.id,
  inlineAction: "reply",
  toIds: [sender.id],
  subject: "Re: Workflow invitation",
  body: "\n\nOn Oct 28, Coordinator wrote:\n> Original invitation",
};
const composeProps = (
  overrides: Partial<ComponentProps<typeof MailComposeWindow>> = {},
): ComponentProps<typeof MailComposeWindow> => ({
  seed,
  inlineHost: host,
  contacts: [sender, other].map((person) => ({
    ...person,
    roles: ["ADVISER"],
  })),
  pending: false,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  onDiscard: vi.fn(),
  ...overrides,
});
const conversationProps = (
  overrides: Partial<ComponentProps<typeof MailConversation>> = {},
): ComponentProps<typeof MailConversation> => ({
  folder: "inbox",
  thread,
  userId: "viewer",
  loading: false,
  canSignAttachments: false,
  pendingAction: false,
  onBack: vi.fn(),
  onThreadAction: vi.fn(),
  onReplyAll: vi.fn(),
  onReply: vi.fn(),
  onForward: vi.fn(),
  onEditDraft: vi.fn(),
  onSendDraft: vi.fn(),
  onDeleteDraft: vi.fn(),
  onOpenAttachment: vi.fn(),
  onDownloadAttachment: vi.fn(),
  onSignAttachment: vi.fn(),
  ...overrides,
});
function renderCompose(props: ComponentProps<typeof MailComposeWindow>) {
  harness.index = 0;
  return MailComposeWindow(props);
}
function renderConversation(props: ComponentProps<typeof MailConversation>) {
  harness.index = 0;
  return MailConversation(props);
}
beforeEach(() => {
  harness.states = [];
  harness.index = 0;
  vi.clearAllMocks();
});

describe("inline correspondence", () => {
  it("opens a nonmodal editor with a blank reply and collapsed quotation", () => {
    const tree = renderCompose(composeProps());
    expect(harness.portal).toHaveBeenCalledWith(expect.anything(), host);
    expect(find(tree, (node) => node.type === "section").props.role).toBe(
      "region",
    );
    expect(byLabel(tree, "Message body").props.value).toBe("");
    expect(byLabel(tree, "Quoted message").props.value).toBe(seed.body);
    expect(
      find(
        tree,
        (node) =>
          node.type === "details" &&
          nodes(node).some(
            (child) => child.props?.["aria-label"] === "Quoted message",
          ),
      ).props.open,
    ).toBeUndefined();
  });

  it("sends only to the selected sender and retains the original quotation", () => {
    const props = composeProps();
    byLabel(renderCompose(props), "Message body").props.onChange({
      target: { value: "Thanks for the invitation." },
    });
    button(renderCompose(props), "Send").props.onClick();
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "send",
        toIds: [sender.id],
        ccIds: [],
        bccIds: [],
        body: `Thanks for the invitation.${seed.body}`,
      }),
    );
  });

  it("keeps text and attachment selections when expanded or moved out of the thread", () => {
    const props = composeProps();
    const file = { name: "notes.txt" } as File;
    let tree = renderCompose(props);
    byLabel(tree, "Message body").props.onChange({
      target: { value: "Reply draft" },
    });
    find(
      tree,
      (node) => node.type === "input" && node.props.type === "file",
    ).props.onChange({ target: { files: [file] } });
    byLabel(renderCompose(props), "Expand compose window").props.onClick();
    tree = renderCompose(props);
    expect(find(tree, (node) => node.type === "section").props.role).toBe(
      "dialog",
    );
    byLabel(tree, "Restore compose window").props.onClick();
    tree = renderCompose({ ...props, inlineHost: null });
    expect(byLabel(tree, "Message body").props.value).toBe("Reply draft");
    button(tree, "Save draft").props.onClick();
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "draft",
        files: [file],
        body: `Reply draft${seed.body}`,
      }),
    );
  });

  it("preserves forwarded attachments and allows choosing the forward recipient", () => {
    const props = composeProps({
      seed: {
        ...seed,
        inlineAction: "forward",
        toIds: [],
        sourceAttachments: [
          { id: "attachment-1", fileName: "manuscript.pdf" } as any,
        ],
      },
    });
    let tree = renderCompose(props);
    find(tree, (node) => node.props?.label === "To").props.onChange([other.id]);
    byLabel(tree, "Message body").props.onChange({
      target: { value: "Please review." },
    });
    tree = renderCompose(props);
    button(tree, "Send").props.onClick();
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        toIds: [other.id],
        sourceAttachmentIds: ["attachment-1"],
      }),
    );
  });

  it("leaves new correspondence in its existing compose window", () => {
    const tree = renderCompose(
      composeProps({ seed: { key: "new" }, inlineHost: null }),
    );
    expect(find(tree, (node) => node.type === "section").props.role).toBe(
      "dialog",
    );
    expect(harness.portal).not.toHaveBeenCalled();
  });

  it("places message actions below the message without an always visible reply form", () => {
    const props = conversationProps();
    const tree = renderConversation(props);
    expect(nodes(tree).some((node) => node.type === "form")).toBe(false);
    button(tree, "Reply").props.onClick();
    expect(props.onReply).toHaveBeenCalledWith(message);
    button(tree, "Forward").props.onClick();
    expect(props.onForward).toHaveBeenCalledWith(message);
  });

  it("retains reply-all text and files after failure, then clears them after success", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(undefined);
    const props = conversationProps({ onReplyAll: send });
    button(renderConversation(props), "Reply all").props.onClick();
    let tree = renderConversation(props);
    const file = { name: "notes.txt" } as File;
    byLabel(tree, "Reply all message").props.onChange({
      target: { value: "For all participants" },
    });
    find(
      tree,
      (node) => node.type === "input" && node.props.type === "file",
    ).props.onChange({ target: { files: [file] } });
    await find(
      renderConversation(props),
      (node) => node.type === "form",
    ).props.onSubmit({ preventDefault() {} });
    tree = renderConversation(props);
    expect(byLabel(tree, "Reply all message").props.value).toBe(
      "For all participants",
    );
    await find(tree, (node) => node.type === "form").props.onSubmit({
      preventDefault() {},
    });
    expect(send).toHaveBeenNthCalledWith(2, "For all participants", [file]);
    button(renderConversation(props), "Reply all").props.onClick();
    expect(
      byLabel(renderConversation(props), "Reply all message").props.value,
    ).toBe("");
  });

  it("keeps reply-all drafts scoped to the conversation", () => {
    const props = conversationProps();
    button(renderConversation(props), "Reply all").props.onClick();
    byLabel(renderConversation(props), "Reply all message").props.onChange({
      target: { value: "Thread A only" },
    });
    const otherProps = { ...props, thread: { ...thread, id: "thread-b" } };
    button(renderConversation(otherProps), "Reply all").props.onClick();
    expect(
      byLabel(renderConversation(otherProps), "Reply all message").props.value,
    ).toBe("");
    button(renderConversation(props), "Reply all").props.onClick();
    expect(
      byLabel(renderConversation(props), "Reply all message").props.value,
    ).toBe("Thread A only");
  });
});
