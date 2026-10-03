"use client";

import React, { useEffect, useState } from "react";
import { ChevronRight, MessageSquarePlus, MessageSquareText, Send, Users, X } from "lucide-react";
import { getChatStore, saveChatStore, GroupChat, GroupChatInvitation, GroupChatMessage } from "@/lib/chat-store";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";

interface AdviserGroupChatsProps {
  triggerToast: (msg: string) => void;
}

export function AdviserGroupChats({ triggerToast }: AdviserGroupChatsProps) {
  const { user } = useAuth();
  const adviserEmail = user?.email || "";
  const adviserName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Faculty Adviser";
  const [assignedStudents, setAssignedStudents] = useState<Array<{ email: string; name: string; group: string }>>([]);
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [invitations, setInvitations] = useState<GroupChatInvitation[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("");
  const [chatDescription, setChatDescription] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const syncWithStore = () => {
    const store = getChatStore();
    setChats(store.chats.filter((chat) => chat.createdByAdviserId === adviserEmail));
    setInvitations(store.invitations);
    setMessages(store.messages);
  };

  useEffect(() => {
    syncWithStore();

    const fetchRealStudents = async () => {
      try {
        const response = await apiClient.get<{ projects: any[] }>("/api/research");
        const list: Array<{ email: string; name: string; group: string }> = [];
        (response?.projects || []).forEach((project) => {
          const group = project.title?.substring(0, 20) || "Research Group";
          project.members?.forEach((member: any) => {
            if (member.user?.email && !list.some((student) => student.email === member.user.email)) {
              list.push({
                email: member.user.email,
                name: `${member.user.firstName || ""} ${member.user.lastName || ""}`.trim() || member.user.email,
                group,
              });
            }
          });
        });
        setAssignedStudents(list);
      } catch {
        setAssignedStudents([]);
      }
    };

    void fetchRealStudents();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "advisio_chat_store") syncWithStore();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [adviserEmail]);

  const handleStudentSelectToggle = (email: string) => {
    setSelectedStudents((current) =>
      current.includes(email) ? current.filter((item) => item !== email) : [...current, email],
    );
  };

  const handleSelectAllGroup = () => {
    const visibleStudents = selectedGroup
      ? assignedStudents.filter((student) => student.group === selectedGroup)
      : assignedStudents;
    setSelectedStudents(visibleStudents.map((student) => student.email));
  };

  const handleCreateChat = (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatTitle.trim() || selectedStudents.length === 0) {
      triggerToast("Please enter a title and select at least one student.");
      return;
    }

    const store = getChatStore();
    const newChatId = `chat-${Date.now()}`;
    const newChat: GroupChat = {
      id: newChatId,
      title: chatTitle,
      description: chatDescription,
      createdByAdviserId: adviserEmail,
      adviserName,
      relatedResearchGroupId: selectedGroup || undefined,
      createdAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    };

    store.chats.push(newChat);
    selectedStudents.forEach((email) => {
      const studentName = assignedStudents.find((student) => student.email === email)?.name || email;
      store.invitations.push({
        id: `inv-${Math.random().toString(36).slice(2, 11)}`,
        groupChatId: newChatId,
        studentId: email,
        studentName,
        invitedByAdviserId: adviserEmail,
        status: "pending",
        invitedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      });
      store.notifications.push({
        id: `notif-${Math.random().toString(36).slice(2, 11)}`,
        userId: email,
        msg: `You have been invited to join a group chat by ${adviserName}.`,
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        read: false,
      });
    });

    saveChatStore(store);
    syncWithStore();
    setChatTitle("");
    setChatDescription("");
    setSelectedStudents([]);
    setActiveChatId(newChatId);
    setIsCreateOpen(false);
    triggerToast(`Group Chat "${chatTitle}" created and invitations dispatched.`);
  };

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeChatId || !msgInput.trim()) return;
    const store = getChatStore();
    store.messages.push({
      id: `msg-${Date.now()}`,
      groupChatId: activeChatId,
      senderId: adviserEmail,
      senderName: adviserName,
      senderRole: "adviser",
      message: msgInput,
      createdAt: new Date().toISOString(),
    });
    saveChatStore(store);
    setMsgInput("");
    syncWithStore();
  };

  const handleRemoveMember = (invitationId: string) => {
    const store = getChatStore();
    const invitation = store.invitations.find((item) => item.id === invitationId);
    if (!invitation) return;
    store.invitations = store.invitations.filter((item) => item.id !== invitationId);
    saveChatStore(store);
    syncWithStore();
    triggerToast(`Removed student ${invitation.studentName} from the thread.`);
  };

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const activeChatMessages = messages.filter((message) => message.groupChatId === activeChatId);
  const activeChatInvitations = invitations.filter((invitation) => invitation.groupChatId === activeChatId);
  const acceptedEmails = activeChatInvitations
    .filter((invitation) => invitation.status === "accepted")
    .map((invitation) => invitation.studentId);
  const groups = Array.from(new Set(assignedStudents.map((student) => student.group)));
  const visibleStudents = selectedGroup
    ? assignedStudents.filter((student) => student.group === selectedGroup)
    : assignedStudents;

  return (
    <section className="grid min-h-[640px] animate-fade-in overflow-hidden rounded-2xl bg-slate-50/70 text-slate-800 dark:bg-white/[0.03] dark:text-slate-100 lg:h-[calc(100vh-184px)] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="relative flex min-h-0 flex-col bg-white p-4 dark:bg-[#101B2B] sm:p-6 lg:border-r lg:border-slate-200/80 dark:lg:border-white/10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Messages</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[#0B3A53] dark:text-white">Conversations</h2>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]">
            <MessageSquareText className="h-5 w-5" />
          </div>
        </div>

        <div className="relative mb-6">
          <button
            type="button"
            onClick={() => setIsCreateOpen((open) => !open)}
            aria-expanded={isCreateOpen}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B3A53] px-4 text-sm font-bold text-white transition hover:bg-[#072A3D]"
          >
            <MessageSquarePlus className="h-5 w-5" />
            New group conversation
          </button>

          {isCreateOpen && (
            <div className="absolute left-0 right-0 top-12 z-30 max-h-[520px] overflow-y-auto rounded-2xl bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 dark:bg-[#162438] dark:ring-white/10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">New message</p>
                  <h3 className="mt-1 text-sm font-bold text-[#0B3A53] dark:text-white">Create a group conversation</h3>
                </div>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateChat} className="space-y-4">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Conversation title
                  <input required value={chatTitle} onChange={(event) => setChatTitle(event.target.value)} placeholder="e.g. Chapter 3 Methodology Q&A" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#C9A227] dark:border-white/10 dark:bg-white/5 dark:text-white" />
                </label>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Description
                  <textarea rows={2} value={chatDescription} onChange={(event) => setChatDescription(event.target.value)} placeholder="Brief guidelines or discussion scope..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal outline-none focus:border-[#C9A227] dark:border-white/10 dark:bg-white/5 dark:text-white" />
                </label>
                {groups.length > 0 && (
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                    Research group
                    <select value={selectedGroup} onChange={(event) => { setSelectedGroup(event.target.value); setSelectedStudents([]); }} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-[#C9A227] dark:border-white/10 dark:bg-white/5 dark:text-white">
                      <option value="">All assigned students</option>
                      {groups.map((groupName) => <option key={groupName} value={groupName}>{groupName}</option>)}
                    </select>
                  </label>
                )}
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.05]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0B3A53] dark:text-white">Select recipients</span>
                    <button type="button" onClick={handleSelectAllGroup} className="text-xs font-bold text-[#C08A16] hover:underline">Select all</button>
                  </div>
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {visibleStudents.map((student) => (
                      <label key={student.email} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-xs text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/5">
                        <input type="checkbox" checked={selectedStudents.includes(student.email)} onChange={() => handleStudentSelectToggle(student.email)} className="mt-0.5 accent-[#C9A227]" />
                        <span className="min-w-0"><strong className="block truncate text-slate-800 dark:text-white">{student.name}</strong><span className="block truncate text-slate-400">{student.email}</span></span>
                      </label>
                    ))}
                    {visibleStudents.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No assigned students available.</p>}
                  </div>
                </div>
                <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FFA400] px-4 text-sm font-bold text-[#072A3D] hover:bg-[#E09000]">
                  <Send className="h-4 w-4" /> Send invitations
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><Users className="h-4 w-4 text-[#0B3A53] dark:text-[#C9A227]" />Active chats</h3>
          <span className="rounded-full bg-[#EAF3F7] px-2 py-1 text-xs font-bold text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]">{chats.length}</span>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {chats.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">Created conversations will appear here.</p>
          ) : (
            chats.map((chat) => {
              const isSelected = chat.id === activeChatId;
              const membersCount = invitations.filter((invitation) => invitation.groupChatId === chat.id && invitation.status === "accepted").length;
              return (
                <button key={chat.id} type="button" onClick={() => setActiveChatId(chat.id)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${isSelected ? "bg-[#DDEBF1] text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${isSelected ? "bg-[#0B3A53] text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>{chat.title.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{chat.title}</span><span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{membersCount} joined · {chat.description || "Advising conversation"}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="flex min-h-[520px] min-w-0 flex-col bg-slate-50/40 dark:bg-[#0D1525]/50 lg:min-h-0">
        {activeChat ? (
          <>
            <header className="shrink-0 bg-white px-4 py-4 dark:bg-[#101B2B] sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0"><h3 className="truncate text-base font-bold text-[#0B3A53] dark:text-white">{activeChat.title}</h3><p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{activeChat.description || "Research advising conversation"}</p></div>
                <span className="hidden rounded-full bg-[#EAF3F7] px-3 py-1 text-xs font-bold text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227] sm:inline-flex">{acceptedEmails.length} joined</span>
              </div>
              {activeChatInvitations.length > 0 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {activeChatInvitations.map((invitation) => (
                    <div key={invitation.id} className="flex shrink-0 items-center gap-2 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 dark:bg-white/[0.06]">
                      <span className="max-w-36 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{invitation.studentName}</span>
                      <Tag variant={invitation.status === "accepted" ? "success" : invitation.status === "pending" ? "warn" : "danger"}>{invitation.status}</Tag>
                      <button type="button" onClick={() => handleRemoveMember(invitation.id)} aria-label={`Remove ${invitation.studentName}`} className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
              {activeChatMessages.length === 0 && (
                <div className="m-auto flex max-w-sm flex-col items-center py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]"><MessageSquareText className="h-6 w-6" /></div>
                  <h4 className="mt-4 text-base font-bold text-[#0B3A53] dark:text-white">Start the conversation</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Send the first message to your advisees.</p>
                </div>
              )}
              {activeChatMessages.map((message) => {
                const isSelf = message.senderId === adviserEmail;
                return (
                  <div key={message.id} className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[75%] ${isSelf ? "self-end items-end" : "self-start items-start"}`}>
                    <span className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{message.senderName} ({message.senderRole})</span>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${isSelf ? "rounded-br-md bg-[#0B3A53] text-white" : "rounded-bl-md bg-white text-slate-800 shadow-xs dark:bg-[#101B2B] dark:text-slate-100"}`}>{message.message}</div>
                    <span className="px-1 text-xs text-slate-400">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="shrink-0 bg-white p-4 dark:bg-[#101B2B] sm:p-6">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-2 dark:bg-white/[0.06]">
                <input type="text" placeholder={acceptedEmails.length === 0 ? "Wait for a student to accept the invitation..." : "Type a message..."} disabled={acceptedEmails.length === 0} value={msgInput} onChange={(event) => setMsgInput(event.target.value)} className="h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-white" />
                <button type="submit" disabled={acceptedEmails.length === 0 || !msgInput.trim()} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FFA400] px-4 text-sm font-bold text-[#072A3D] hover:bg-[#E09000] disabled:cursor-not-allowed disabled:opacity-50"><span className="hidden sm:inline">Send</span><Send className="h-4 w-4" /></button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]"><MessageSquareText className="h-7 w-7" /></div>
              <h3 className="mt-6 text-xl font-bold tracking-tight text-[#0B3A53] dark:text-white">Select a conversation</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Choose a conversation from the left panel to view and send messages.</p>
              <button type="button" onClick={() => setIsCreateOpen(true)} className="mx-auto mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B3A53] px-5 text-sm font-bold text-white hover:bg-[#072A3D]"><MessageSquarePlus className="h-5 w-5" />New group conversation</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
