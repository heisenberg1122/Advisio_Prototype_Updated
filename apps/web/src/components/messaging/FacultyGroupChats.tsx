"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessageSquarePlus,
  MessageSquareText,
  Search,
  Send,
  ShieldCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { realtimeClient } from "@/lib/realtime/sse-client";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/providers/auth-provider";

type ParticipantStatus = "pending" | "accepted" | "declined" | "removed";

interface Participant {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  status: ParticipantStatus;
  isAdmin: boolean;
}

interface Chat {
  id: string;
  title: string;
  description: string;
  adviserName: string;
  isFacultyOnly: boolean;
  isAdmin: boolean;
  membershipStatus: ParticipantStatus;
  unreadCount: number;
  lastMessageAt?: string;
  createdAt: string;
  participants: Participant[];
}

interface Invitation {
  id: string;
  groupChatId: string;
  status: "pending" | "accepted" | "declined";
  invitedAt: string;
}

interface ChatMessage {
  id: string;
  groupChatId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  isAssignedStudent: boolean;
}

interface ChatPayload {
  chats: Chat[];
  invitations: Invitation[];
  messages: ChatMessage[];
}

const FILTERS = [
  { id: "all", label: "All Faculty" },
  { id: "advisers", label: "Advisers" },
  { id: "professors", label: "Professors" },
  { id: "panelists", label: "Panelists" },
  { id: "students", label: "Assigned Students" },
] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function roleMatches(recipient: Recipient, filter: string) {
  if (filter === "students") return recipient.isAssignedStudent;
  if (recipient.isAssignedStudent) return false;
  if (filter === "advisers") return recipient.roles.includes("ADVISER");
  if (filter === "professors") return recipient.roles.includes("RESEARCH_COORDINATOR");
  if (filter === "panelists") return recipient.roles.includes("PANELIST");
  return true;
}

function MessagingSkeleton() {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="grid min-h-[720px] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-[#0c1420] lg:h-[calc(100vh-124px)] lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]"
    >
      <span className="sr-only">Loading conversations</span>
      <aside className="border-b border-slate-200/80 p-4 dark:border-slate-800 sm:p-5 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
        </div>
        <Skeleton className="mt-4 h-9 w-full rounded-xl" />
        <div className="mt-5 space-y-2">
          <Skeleton className="mb-2 h-3 w-20" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl p-2.5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className={index % 2 ? "h-3.5 w-3/4" : "h-3.5 w-2/3"} />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="hidden min-h-0 flex-col bg-white dark:bg-[#0c1420] lg:flex">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-800 sm:px-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1.5 h-3 w-64 max-w-full" />
        </div>
        <div className="min-h-0 flex-1 space-y-4 p-6">
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-20 w-3/5 rounded-2xl bg-[var(--color-primary)]/15" />
          <Skeleton className="h-16 w-1/2 rounded-2xl" />
        </div>
        <div className="border-t border-slate-200/80 p-4 dark:border-slate-800 sm:px-6">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </main>
    </section>
  );
}

function formatMessageTime(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}

export function FacultyGroupChats({ triggerToast }: { triggerToast?: (message: string) => void }) {
  const { user } = useAuth();
  const canCreate = Boolean(user?.roles.some((role) => ["ADVISER", "RESEARCH_COORDINATOR", "PANELIST", "RPO", "REB", "VPAA"].includes(role)));
  const [payload, setPayload] = useState<ChatPayload>({ chats: [], invitations: [], messages: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const toast = useCallback((value: string) => triggerToast?.(value), [triggerToast]);
  const loadChats = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await apiClient.get<ChatPayload>("/api/chats");
      setPayload(data);
      setError("");
      setActiveChatId((current) => current && data.chats.some((chat) => chat.id === current && chat.membershipStatus === "accepted") ? current : null);
    } catch (requestError: any) {
      setError(requestError.message || "Unable to load conversations.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChats();
    const interval = window.setInterval(() => void loadChats(true), 10000);
    const unsubscribeMessage = realtimeClient.on("chat:message", () => void loadChats(true));
    const unsubscribeInvite = realtimeClient.on("chat:invitation", () => void loadChats(true));
    const unsubscribeUpdate = realtimeClient.on("chat:updated", () => void loadChats(true));
    return () => {
      window.clearInterval(interval);
      unsubscribeMessage();
      unsubscribeInvite();
      unsubscribeUpdate();
    };
  }, [loadChats]);

  useEffect(() => {
    if (!isComposerOpen) return;
    setRecipientsLoading(true);
    apiClient.get<{ recipients: Recipient[] }>("/api/chats/recipients", { params: { category: "eligible" } })
      .then((data) => setRecipients(data.recipients))
      .catch((requestError) => setError(requestError.message || "Unable to load recipients."))
      .finally(() => setRecipientsLoading(false));
  }, [isComposerOpen]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeChatId, payload.messages.length]);

  const acceptedChats = useMemo(() => payload.chats.filter((chat) => chat.membershipStatus === "accepted"), [payload.chats]);
  const pendingInvitations = payload.invitations.filter((invitation) => invitation.status === "pending");
  const activeChat = acceptedChats.find((chat) => chat.id === activeChatId) || null;
  const activeMessages = payload.messages.filter((item) => item.groupChatId === activeChatId);
  const query = search.trim().toLowerCase();
  const filteredRecipients = recipients.filter((recipient) => roleMatches(recipient, filter) && (!query || `${recipient.name} ${recipient.email} ${recipient.role}`.toLowerCase().includes(query)));

  const resetComposer = () => {
    setIsComposerOpen(false);
    setTitle("");
    setDescription("");
    setSearch("");
    setFilter("all");
    setSelectedIds([]);
  };

  useEffect(() => {
    if (!isComposerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(event.target as Node)) {
        resetComposer();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isComposerOpen]);

  const toggleRecipient = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectFiltered = () => {
    const filteredIds = filteredRecipients.map((recipient) => recipient.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => allSelected ? current.filter((id) => !filteredIds.includes(id)) : [...new Set([...current, ...filteredIds])]);
  };

  const createConversation = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !selectedIds.length) return;
    setSaving(true);
    try {
      const includesStudents = recipients.some((recipient) => selectedIds.includes(recipient.id) && recipient.isAssignedStudent);
      await apiClient.post("/api/chats", { title, description, participantIds: selectedIds, includeStudents: includesStudents });
      resetComposer();
      await loadChats(true);
      toast("Group invitation sent.");
    } catch (requestError: any) {
      setError(requestError.message || "Unable to create the conversation.");
    } finally {
      setSaving(false);
    }
  };

  const respondToInvitation = async (invitation: Invitation, status: "accepted" | "declined") => {
    try {
      await apiClient.patch(`/api/chats/invitations/${invitation.id}`, { status });
      await loadChats(true);
      if (status === "accepted") setActiveChatId(invitation.groupChatId);
      toast(status === "accepted" ? "Invitation accepted." : "Invitation declined.");
    } catch (requestError: any) {
      setError(requestError.message || "Unable to update the invitation.");
    }
  };

  const openConversation = async (chatId: string) => {
    setActiveChatId(chatId);
    try {
      await apiClient.post(`/api/chats/${chatId}/read`);
      setPayload((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === chatId ? { ...chat, unreadCount: 0 } : chat) }));
    } catch {
      // The next refresh reconciles read state if this request races with a membership update.
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeChatId || !message.trim() || saving) return;
    setSaving(true);
    try {
      await apiClient.post(`/api/chats/${activeChatId}/messages`, { message });
      setMessage("");
      await loadChats(true);
    } catch (requestError: any) {
      setError(requestError.message || "Unable to send the message.");
    } finally {
      setSaving(false);
    }
  };

  const removeParticipant = async (participant: Participant) => {
    if (!activeChat || !window.confirm(`Remove ${participant.name} from this conversation?`)) return;
    try {
      await apiClient.delete(`/api/chats/${activeChat.id}/participants/${participant.id}`);
      await loadChats(true);
      toast(`${participant.name} was removed.`);
    } catch (requestError: any) {
      setError(requestError.message || "Unable to remove this member.");
    }
  };

  if (loading) return <MessagingSkeleton />;

  return (
    <section className="grid min-h-[720px] w-full animate-fade-in overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-[#0c1420] lg:h-[calc(100vh-124px)] lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* LEFT PANEL: CONVERSATIONS SIDEBAR */}
      <aside className={`relative min-h-0 flex-col border-b border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#0e1726] sm:p-5 lg:border-b-0 lg:border-r ${activeChatId ? "hidden lg:flex" : "flex"}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#58647A] dark:text-slate-400">Advisio Messages</p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[#0B3A53] dark:text-white">Conversations</h2>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-sky-400">
            <MessageSquareText className="h-4.5 w-4.5" />
          </div>
        </div>

        {canCreate && (
          <div ref={composerRef} className="relative mb-4">
            <button
              type="button"
              onClick={() => setIsComposerOpen((value) => !value)}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#0B3A53] px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#072A3D] active:scale-[0.99] dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span>New group conversation</span>
            </button>
            {isComposerOpen && (
              <form
                onSubmit={createConversation}
                role="dialog"
                aria-label="Create a group conversation"
                className="absolute left-0 top-11 z-50 w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-[#141f30] sm:p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#58647A] dark:text-slate-400">New message</p>
                    <h3 className="mt-0.5 text-base font-bold text-[#0B3A53] dark:text-white">Create a group conversation</h3>
                  </div>
                  <button type="button" onClick={resetComposer} className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <label className="mt-3.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Conversation title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={200}
                    placeholder="e.g. Thesis Defense Committee"
                    className="mt-1.5 h-9.5 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#0B3A53] dark:border-slate-700 dark:bg-white/5 dark:focus:border-sky-400"
                  />
                </label>
                <label className="mt-2.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    placeholder="Enter group description…"
                    className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-[#0B3A53] dark:border-slate-700 dark:bg-white/5 dark:focus:border-sky-400"
                  />
                </label>
                <div className="my-3.5 border-t border-slate-100 dark:border-white/10" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Select recipients</span>
                  <button type="button" onClick={selectFiltered} className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-400">
                    Select filtered
                  </button>
                </div>
                <label className="mt-2 flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search faculty or student…"
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                </label>
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition ${
                        filter === item.id
                          ? "border-[#0B3A53] bg-[#0B3A53] text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 max-h-48 space-y-1 overflow-y-auto pr-1">
                  {recipientsLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-1/2" />
                          <Skeleton className="h-2.5 w-1/3" />
                        </div>
                      </div>
                    ))
                  ) : filteredRecipients.length ? (
                    filteredRecipients.map((recipient) => {
                      const selected = selectedIds.includes(recipient.id);
                      return (
                        <button
                          key={recipient.id}
                          type="button"
                          onClick={() => toggleRecipient(recipient.id)}
                          className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EAF3F7] text-xs font-bold text-[#0B3A53] dark:bg-sky-400/15 dark:text-sky-300">
                            {initials(recipient.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold">{recipient.name}</span>
                            <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {recipient.role}
                              {recipient.isAssignedStudent ? " · Assigned student" : ""}
                            </span>
                          </span>
                          <span
                            className={`grid h-4.5 w-4.5 place-items-center rounded-full border transition ${
                              selected
                                ? "border-[#0B3A53] bg-[#0B3A53] text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950"
                                : "border-slate-300 dark:border-white/20"
                            }`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                      No eligible recipients found for this filter.
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!title.trim() || !selectedIds.length || saving}
                  className="mt-3.5 flex h-9.5 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Users className="h-3.5 w-3.5" />
                  {saving ? "Creating…" : `Create group (${selectedIds.length} selected)`}
                </button>
              </form>
            )}
          </div>
        )}

        {error && (
          <div className="mb-3.5 rounded-xl border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
            <button type="button" onClick={() => setError("")} className="float-right text-rose-500 hover:text-rose-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
          {/* INVITATIONS */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#58647A] dark:text-slate-400">
                <Inbox className="h-3.5 w-3.5 text-amber-500" />
                Invitations
              </span>
              {pendingInvitations.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  {pendingInvitations.length}
                </span>
              )}
            </div>
            {pendingInvitations.map((invitation) => {
              const chat = payload.chats.find((item) => item.id === invitation.groupChatId);
              return (
                <article
                  key={invitation.id}
                  className="mb-2 rounded-xl border border-amber-200/70 bg-amber-50/40 p-3 transition-all dark:border-amber-500/20 dark:bg-amber-500/5"
                >
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                    {chat?.title || "Group invitation"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Invited by {chat?.adviserName || "Faculty member"}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => respondToInvitation(invitation, "accepted")}
                      className="flex-1 rounded-lg bg-[#0B3A53] py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#072A3D] dark:bg-sky-400 dark:text-slate-950"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToInvitation(invitation, "declined")}
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Decline
                    </button>
                  </div>
                </article>
              );
            })}
            {!pendingInvitations.length && (
              <p className="px-1 py-1.5 text-xs text-slate-400 dark:text-slate-500">
                No pending invitations
              </p>
            )}
          </div>

          {/* ACTIVE CHATS */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#58647A] dark:text-slate-400">
                <Users className="h-3.5 w-3.5 text-[#58647A] dark:text-slate-400" />
                Active Chats
              </span>
              {acceptedChats.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {acceptedChats.length}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {acceptedChats.map((chat) => {
                const isSelected = activeChatId === chat.id;
                const memberCount = chat.participants.filter((item) => item.status === "accepted").length;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => openConversation(chat.id)}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-[#EAF3F7] text-[#0B3A53] shadow-2xs dark:bg-sky-400/10 dark:text-white"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#0B3A53] dark:bg-sky-400" />
                    )}
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                        isSelected
                          ? "bg-[#0B3A53] text-white dark:bg-sky-400 dark:text-slate-950"
                          : "bg-[#58647A]/15 text-[#0B3A53] dark:bg-white/10 dark:text-sky-300 group-hover:bg-[#0B3A53]/20"
                      }`}
                    >
                      {initials(chat.title)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold leading-tight text-slate-900 dark:text-slate-100">
                        {chat.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {memberCount} member{memberCount !== 1 ? "s" : ""} · {chat.isFacultyOnly ? "Faculty" : "Research group"}
                      </span>
                    </span>
                    {chat.unreadCount > 0 ? (
                      <span className="grid min-w-5 h-5 place-items-center rounded-full bg-[#F5A800] px-1.5 text-[10px] font-bold text-[#102F49] shrink-0">
                        {chat.unreadCount}
                      </span>
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" />
                    )}
                  </button>
                );
              })}
            </div>
            {!acceptedChats.length && (
              <div className="py-6 px-2 text-center text-xs text-slate-400 dark:text-slate-500">
                No active conversations yet
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL: CHAT WORKSPACE */}
      <main className={`min-h-[550px] min-w-0 flex-1 flex-col bg-white dark:bg-[#0c1420] lg:min-h-0 ${activeChatId ? "flex" : "hidden lg:flex"}`}>
        {!activeChat ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center select-none">
            <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500">
              <MessageSquareText className="h-6 w-6 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Select a conversation
            </h3>
            <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">
              Choose a conversation from the sidebar to view messages or collaborate with your group.
            </p>
          </div>
        ) : (
          <>
            {/* CONVERSATION HEADER */}
            <header className="flex flex-col gap-2 border-b border-slate-200/80 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-[#0e1726] sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveChatId(null)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-bold text-[#0B3A53] dark:text-white">
                        {activeChat.title}
                      </h3>
                      {activeChat.isFacultyOnly && (
                        <span
                          title="Faculty only"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Faculty
                        </span>
                      )}
                    </div>
                    {activeChat.description && (
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {activeChat.description}
                      </p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {activeChat.participants.filter((item) => item.status === "accepted").length} members
                </span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 pt-0.5">
                {activeChat.participants
                  .filter((participant) => participant.status !== "removed")
                  .map((participant) => (
                    <span
                      key={participant.id}
                      className="group flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                    >
                      <span>{participant.name}</span>
                      <span className="text-slate-400">· {participant.role}</span>
                      {participant.isAdmin && <ShieldCheck className="h-3 w-3 text-emerald-500" />}
                      {activeChat.isAdmin && participant.userId !== user?.id && (
                        <button
                          type="button"
                          onClick={() => removeParticipant(participant)}
                          aria-label={`Remove ${participant.name}`}
                          className="ml-0.5 hidden text-rose-500 hover:text-rose-700 group-hover:inline-block"
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
              </div>
            </header>

            {/* MESSAGES STREAM */}
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-6">
              {activeMessages.map((item) => {
                const mine = item.senderId === user?.id || item.senderId === user?.email;
                return (
                  <article key={item.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-2xs ${
                        mine
                          ? "rounded-br-xs bg-[#0B3A53] text-white dark:bg-sky-400 dark:text-slate-950"
                          : "rounded-bl-xs border border-slate-200/80 bg-slate-50/70 text-slate-800 dark:border-slate-800 dark:bg-[#141f30] dark:text-slate-100"
                      }`}
                    >
                      <div
                        className={`mb-1 text-[10px] font-bold ${
                          mine ? "text-sky-100/90 dark:text-slate-800 font-extrabold" : "text-[#58647A] dark:text-slate-400"
                        }`}
                      >
                        {item.senderName} · {item.senderRole}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.message}</p>
                    </div>
                    <time className="mt-1 px-1 text-[10px] text-slate-400 dark:text-slate-500">
                      {formatMessageTime(item.createdAt)}
                    </time>
                  </article>
                );
              })}
              {!activeMessages.length && (
                <div className="flex h-full min-h-60 flex-col items-center justify-center text-center text-xs text-slate-400 dark:text-slate-500">
                  <MessageSquareText className="h-8 w-8 stroke-[1.2] text-slate-300 dark:text-slate-600 mb-2" />
                  <p>No messages yet in this conversation.</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Send a message below to start collaborating.</p>
                </div>
              )}
              <div ref={messageEndRef} />
            </div>

            {/* MESSAGE INPUT COMPOSER */}
            <form
              onSubmit={sendMessage}
              className="border-t border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-[#0e1726] sm:px-6"
            >
              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2 transition focus-within:border-[#0B3A53] focus-within:bg-white focus-within:shadow-xs dark:border-slate-700 dark:bg-slate-800/40 dark:focus-within:border-sky-400 dark:focus-within:bg-[#0c1420]">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={1}
                  placeholder="Write a message… (Press Enter to send, Shift+Enter for new line)"
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!message.trim() || saving}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#0B3A53] text-white transition hover:bg-[#072A3D] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </section>
  );
}

