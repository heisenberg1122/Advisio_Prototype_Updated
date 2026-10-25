import type { WorkflowInboxInvitation } from "../workflow/WorkflowInvitationActions";
import type { MailAttachment } from "./MailAttachmentMenu";

export type MailFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "archive"
  | "trash"
  | "signature-requests";

export type MailFilter = "all" | "unread" | "attachments";
export type MailRecipientType = "SENDER" | "TO" | "CC" | "BCC";

export interface MailPerson {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
}

export interface MailContact extends MailPerson {
  roles: string[];
  college?: { name: string } | null;
}

export interface MailParticipant {
  threadId: string;
  userId: string;
  recipientType: MailRecipientType;
  readAt?: string | null;
  archivedAt?: string | null;
  trashedAt?: string | null;
  user: MailPerson;
}

export interface MailMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  isDraft: boolean;
  createdAt: string;
  sentAt?: string | null;
  sender: MailPerson;
  attachments: MailAttachment[];
}

export interface MailThread {
  workflowInvitation?: WorkflowInboxInvitation | null;
  id: string;
  subject: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  participants: MailParticipant[];
  messages: MailMessage[];
  unread: boolean;
}

export interface MailCounts {
  inbox: number;
  unread: number;
  sent: number;
  drafts: number;
  archive: number;
  trash: number;
}

export interface MailPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MailThreadListResponse {
  threads: MailThread[];
  counts: MailCounts;
  pagination: MailPagination;
}

export interface ComposeSeed {
  key: string;
  draftId?: string;
  toIds?: string[];
  ccIds?: string[];
  bccIds?: string[];
  subject?: string;
  body?: string;
  existingAttachments?: MailAttachment[];
  sourceAttachments?: MailAttachment[];
}

export interface ComposeSubmission {
  action: "send" | "draft";
  draftId?: string;
  toIds: string[];
  ccIds: string[];
  bccIds: string[];
  subject: string;
  body: string;
  files: File[];
  keepAttachmentIds: string[];
  sourceAttachmentIds: string[];
}

export function personName(person?: Partial<MailPerson> | null) {
  return (
    [person?.firstName, person?.middleName, person?.lastName]
      .filter(Boolean)
      .join(" ") ||
    person?.email ||
    "User"
  );
}

export function personInitials(person?: Partial<MailPerson> | null) {
  const name = personName(person);
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatMailDate(value?: string | null, compact = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat(undefined, {
    ...(sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : compact
        ? { month: "short", day: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" }),
  }).format(date);
}
