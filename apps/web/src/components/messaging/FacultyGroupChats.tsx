"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
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
    <section role="status" aria-label="Loading conversations" className="grid min-h-[700px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101B2B] lg:h-[calc(100vh-112px)] lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="border-r border-slate-200 p-6 dark:border-white/10">
        <div className="flex items-center justify-between"><div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-36" /></div><Skeleton className="h-11 w-11 rounded-xl" /></div>
        <Skeleton className="mt-6 h-11 w-full rounded-xl" />
        <div className="mt-7 space-y-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="flex gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div>)}</div>
      </aside>
      <main className="hidden bg-slate-50/70 p-7 dark:bg-black/10 lg:block"><Skeleton className="h-16 w-full rounded-2xl" /><div className="mt-8 space-y-4"><Skeleton className="h-20 w-2/3 rounded-2xl" /><Skeleton className="ml-auto h-24 w-3/5 rounded-2xl" /><Skeleton className="h-20 w-1/2 rounded-2xl" /></div><Skeleton className="mt-[360px] h-14 w-full rounded-2xl" /></main>
    </section>
  );
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
    <section className="grid min-h-[700px] w-full animate-fade-in bg-white text-slate-800 dark:bg-[#101B2B] dark:text-slate-100 lg:h-[calc(100vh-112px)] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
      <aside className="relative flex min-h-0 flex-col bg-white p-4 dark:bg-[#101B2B] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Messages</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[#0B3A53] dark:text-white">Conversations</h2></div>
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-sky-400"><MessageSquareText className="h-5 w-5" /></div>
        </div>

        {canCreate && <div ref={composerRef} className="relative mb-5">
          <button type="button" onClick={() => setIsComposerOpen((value) => !value)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B3A53] px-4 text-sm font-bold text-white hover:bg-[#072A3D] dark:bg-sky-400 dark:text-[#080E18]"><MessageSquarePlus className="h-5 w-5" />New group conversation</button>
          {isComposerOpen && (
            <form onSubmit={createConversation} role="dialog" aria-label="Create a group conversation" className="absolute left-0 top-12 z-40 w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,.22)] dark:border-white/10 dark:bg-[#162438] sm:p-5">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">New message</p><h3 className="mt-1 text-lg font-black text-[#0B3A53] dark:text-white">Create a group conversation</h3></div><button type="button" onClick={resetComposer} className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div>
              <label className="mt-4 block text-xs font-bold text-slate-700 dark:text-slate-200">Conversation title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="e.g. Thesis Defense Committee" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-sky-500 dark:border-white/10 dark:bg-white/5" /></label>
              <label className="mt-3 block text-xs font-bold text-slate-700 dark:text-slate-200">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Enter group description…" className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal outline-none focus:border-sky-500 dark:border-white/10 dark:bg-white/5" /></label>
              <div className="my-4 border-t border-slate-100 dark:border-white/10" />
              <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700 dark:text-slate-200">Select recipients</span><button type="button" onClick={selectFiltered} className="text-xs font-bold text-sky-700 hover:underline dark:text-sky-400">Select filtered</button></div>
              <label className="mt-2 flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-white/10"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search faculty…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{FILTERS.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${filter === item.id ? "border-[#0B3A53] bg-[#0B3A53] text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950" : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300"}`}>{item.label}</button>)}</div>
              <div className="mt-3 max-h-52 space-y-1 overflow-y-auto pr-1">
                {recipientsLoading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex items-center gap-3 p-2"><Skeleton className="h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-2.5 w-1/3" /></div></div>) : filteredRecipients.length ? filteredRecipients.map((recipient) => {
                  const selected = selectedIds.includes(recipient.id);
                  return <button key={recipient.id} type="button" onClick={() => toggleRecipient(recipient.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAF3F7] text-xs font-black text-[#0B3A53] dark:bg-sky-400/15 dark:text-sky-300">{initials(recipient.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{recipient.name}</span><span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{recipient.role}{recipient.isAssignedStudent ? " · Assigned student" : ""}</span></span><span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? "border-[#0B3A53] bg-[#0B3A53] text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950" : "border-slate-300 dark:border-white/20"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span></button>;
                }) : <div className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">No eligible recipients found for this filter.</div>}
              </div>
              <button type="submit" disabled={!title.trim() || !selectedIds.length || saving} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F5A800] text-sm font-black text-[#102F49] disabled:cursor-not-allowed disabled:opacity-40"><Users className="h-4 w-4" />{saving ? "Creating…" : `Create group (${selectedIds.length} selected)`}</button>
            </form>
          )}
        </div>}

        {error && <div className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}<button type="button" onClick={() => setError("")} className="float-right"><X className="h-4 w-4" /></button></div>}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><Inbox className="h-4 w-4 text-amber-500" />Invitations</span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{pendingInvitations.length}</span></div>
          {pendingInvitations.map((invitation) => {
            const chat = payload.chats.find((item) => item.id === invitation.groupChatId);
            return <article key={invitation.id} className="mb-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5"><p className="truncate text-sm font-bold">{chat?.title || "Group invitation"}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Invited by {chat?.adviserName}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => respondToInvitation(invitation, "accepted")} className="flex-1 rounded-lg bg-[#0B3A53] py-2 text-xs font-bold text-white dark:bg-sky-400 dark:text-slate-950">Accept</button><button type="button" onClick={() => respondToInvitation(invitation, "declined")} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-bold dark:border-white/10">Decline</button></div></article>;
          })}
          {!pendingInvitations.length && <p className="mb-6 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">No pending invitations.</p>}

          <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><Users className="h-4 w-4" />Active chats</span><span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{acceptedChats.length}</span></div>
          <div className="space-y-1">{acceptedChats.map((chat) => <button key={chat.id} type="button" onClick={() => openConversation(chat.id)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${activeChatId === chat.id ? "bg-[#EAF3F7] dark:bg-sky-400/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0B3A53] text-xs font-black text-white dark:bg-sky-400 dark:text-slate-950">{initials(chat.title)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{chat.title}</span><span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{chat.participants.filter((item) => item.status === "accepted").length} members · {chat.isFacultyOnly ? "Faculty" : "Research group"}</span></span>{chat.unreadCount > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-[#F5A800] px-1.5 py-0.5 text-[10px] font-black text-[#102F49]">{chat.unreadCount}</span> : <ChevronRight className="h-4 w-4 text-slate-300" />}</button>)}</div>
          {!acceptedChats.length && <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">Accepted conversations will appear here.</p>}
        </div>
      </aside>

      <main className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/70 shadow-sm dark:border-white/10 dark:bg-black/10 lg:min-h-0 lg:rounded-l-none lg:rounded-r-[22px]">
        {!activeChat ? <div className="grid flex-1 place-items-center p-8 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-sky-400/10 dark:text-sky-400"><MessageSquareText className="h-7 w-7" /></div><h3 className="mt-5 text-lg font-black text-[#0B3A53] dark:text-white">Select a conversation</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Choose a conversation from the left panel to view and send messages.</p></div></div> : <>
          <header className="border-b border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#101B2B] sm:px-7">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-lg font-black text-[#0B3A53] dark:text-white">{activeChat.title}</h3>{activeChat.isFacultyOnly && <span title="Faculty only"><ShieldCheck className="h-4 w-4 text-emerald-600" /></span>}</div><p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{activeChat.description || "Group conversation"}</p></div><span className="shrink-0 text-[11px] font-semibold text-slate-400">{activeChat.participants.filter((item) => item.status === "accepted").length} members</span></div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{activeChat.participants.filter((participant) => participant.status !== "removed").map((participant) => <span key={participant.id} className="group flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><span>{participant.name}</span><span className="text-slate-400">· {participant.role}</span>{participant.isAdmin && <ShieldCheck className="h-3 w-3 text-emerald-500" />}{activeChat.isAdmin && participant.userId !== user?.id && <button type="button" onClick={() => removeParticipant(participant)} aria-label={`Remove ${participant.name}`} className="ml-0.5 hidden text-rose-500 group-hover:block"><UserMinus className="h-3 w-3" /></button>}</span>)}</div>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-7">{activeMessages.map((item) => {
            const mine = item.senderId === user?.id || item.senderId === user?.email;
            return <article key={item.id} className={`max-w-[85%] ${mine ? "ml-auto" : "mr-auto"}`}><div className={`rounded-2xl px-4 py-3 ${mine ? "rounded-br-md bg-[#0B3A53] text-white dark:bg-sky-400 dark:text-slate-950" : "rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-[#162438] dark:text-slate-100"}`}><div className={`mb-1 text-[10px] font-bold ${mine ? "text-sky-100 dark:text-slate-700" : "text-slate-500 dark:text-slate-400"}`}>{item.senderName} · {item.senderRole}</div><p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p></div><time className={`mt-1 block px-1 text-[10px] text-slate-400 ${mine ? "text-right" : "text-left"}`}>{new Date(item.createdAt).toLocaleString()}</time></article>;
          })}{!activeMessages.length && <div className="grid h-full min-h-64 place-items-center text-center text-sm text-slate-400">No messages yet. Start the conversation.</div>}<div ref={messageEndRef} /></div>
          <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#101B2B] sm:px-7"><div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 focus-within:border-sky-500 dark:border-white/10 dark:bg-white/5"><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={1} placeholder="Write a message…" className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" disabled={!message.trim() || saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F5A800] text-[#102F49] disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button></div></form>
        </>}
      </main>
    </section>
  );
}
