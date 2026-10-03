"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Inbox, MessageSquarePlus, MessageSquareText, Search, Send, Users, X } from "lucide-react";
import { getChatStore, saveChatStore, GroupChat, GroupChatInvitation, GroupChatMessage } from "@/lib/chat-store";
import { useAuth } from "@/providers/auth-provider";

interface StudentGroupChatsProps {
  triggerToast: (msg: string) => void;
}

export function StudentGroupChats({ triggerToast }: StudentGroupChatsProps) {
  const { user } = useAuth();
  const studentEmail = user?.email || "";
  const studentName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Student Researcher";

  const [chats, setChats] = useState<GroupChat[]>([]);
  const [invitations, setInvitations] = useState<GroupChatInvitation[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState("");
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [newMessageQuery, setNewMessageQuery] = useState("");
  const newMessagePanelRef = useRef<HTMLDivElement>(null);
  const newMessageInputRef = useRef<HTMLInputElement>(null);

  const syncWithStore = () => {
    const store = getChatStore();
    setChats(store.chats);
    setInvitations(store.invitations.filter((invitation) => invitation.studentId === studentEmail));
    setMessages(store.messages);
  };

  useEffect(() => {
    syncWithStore();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "advisio_chat_store") {
        syncWithStore();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!isNewMessageOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (newMessagePanelRef.current && !newMessagePanelRef.current.contains(event.target as Node)) {
        setIsNewMessageOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNewMessageOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => newMessageInputRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNewMessageOpen]);

  const handleAccept = (invitationId: string) => {
    const store = getChatStore();
    const invitation = store.invitations.find((item) => item.id === invitationId);
    if (!invitation) return;

    invitation.status = "accepted";
    invitation.respondedAt = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    store.notifications.push({
      id: "notif-" + Math.random().toString(36).substr(2, 9),
      userId: invitation.invitedByAdviserId,
      msg: `${studentName} has accepted your invitation to join the group chat.`,
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      read: false,
    });

    saveChatStore(store);
    syncWithStore();
    setActiveChatId(invitation.groupChatId);
    triggerToast("Invitation accepted! You joined the chat thread.");
  };

  const handleDecline = (invitationId: string) => {
    const store = getChatStore();
    const invitation = store.invitations.find((item) => item.id === invitationId);
    if (!invitation) return;

    invitation.status = "declined";
    invitation.respondedAt = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    store.notifications.push({
      id: "notif-" + Math.random().toString(36).substr(2, 9),
      userId: invitation.invitedByAdviserId,
      msg: `${studentName} has declined your invitation to join the group chat.`,
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      read: false,
    });

    saveChatStore(store);
    syncWithStore();
    if (activeChatId === invitation.groupChatId) {
      setActiveChatId(null);
    }
    triggerToast("Invitation declined.");
  };

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeChatId || !msgInput.trim()) return;

    const store = getChatStore();
    const activeInvitation = store.invitations.find(
      (invitation) => invitation.groupChatId === activeChatId && invitation.studentId === studentEmail
    );

    if (!activeInvitation || activeInvitation.status !== "accepted") {
      triggerToast("Cannot send message: Invitation not accepted.");
      return;
    }

    const newMessage: GroupChatMessage = {
      id: "msg-" + Date.now(),
      groupChatId: activeChatId,
      senderId: studentEmail,
      senderName: studentName,
      senderRole: "student",
      message: msgInput,
      createdAt: new Date().toISOString(),
    };

    store.messages.push(newMessage);
    saveChatStore(store);
    setMsgInput("");
    syncWithStore();
  };

  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");
  const acceptedInvitations = invitations.filter((invitation) => invitation.status === "accepted");
  const activeChats = chats.filter((chat) =>
    acceptedInvitations.some((invitation) => invitation.groupChatId === chat.id)
  );
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const activeInvitationForChat = invitations.find((invitation) => invitation.groupChatId === activeChatId);
  const activeChatMessages = messages.filter((message) => message.groupChatId === activeChatId);
  const normalizedNewMessageQuery = newMessageQuery.trim().toLowerCase();
  const filteredActiveChats = activeChats.filter((chat) =>
    !normalizedNewMessageQuery ||
    chat.title.toLowerCase().includes(normalizedNewMessageQuery) ||
    chat.adviserName.toLowerCase().includes(normalizedNewMessageQuery)
  );

  const openConversation = (chatId: string) => {
    setActiveChatId(chatId);
    setIsNewMessageOpen(false);
    setNewMessageQuery("");
  };

  return (
    <section className="grid min-h-[640px] animate-fade-in overflow-hidden rounded-2xl bg-slate-50/70 text-slate-800 dark:bg-white/[0.03] dark:text-slate-100 lg:h-[calc(100vh-184px)] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="relative flex min-h-0 flex-col bg-white p-4 dark:bg-[#101B2B] sm:p-6 lg:border-r lg:border-slate-200/80">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Messages</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[#0B3A53] dark:text-white">Conversations</h2>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#38bdf8]">
            <MessageSquareText className="h-5 w-5" />
          </div>
        </div>

        <div ref={newMessagePanelRef} className="relative mb-6">
          <button
            type="button"
            onClick={() => setIsNewMessageOpen((isOpen) => !isOpen)}
            aria-expanded={isNewMessageOpen}
            aria-haspopup="dialog"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B3A53] px-4 text-sm font-bold text-white shadow-xs transition-colors hover:bg-[#072A3D] dark:bg-[#38bdf8] dark:text-[#080E18] dark:hover:bg-[#7dd3fc]"
          >
            <MessageSquarePlus className="h-5 w-5" />
            New message
          </button>

          {isNewMessageOpen && (
            <div
              role="dialog"
              aria-label="Start a message"
              className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-2xl bg-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 dark:bg-[#162438] dark:ring-white/10"
            >
              <div className="p-3">
                <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-3 text-slate-400 dark:bg-white/[0.06]">
                  <Search className="h-4 w-4 shrink-0" />
                  <input
                    ref={newMessageInputRef}
                    type="search"
                    value={newMessageQuery}
                    onChange={(event) => setNewMessageQuery(event.target.value)}
                    placeholder="Search people or conversations"
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
                    aria-label="Search available conversations"
                  />
                  <button
                    type="button"
                    onClick={() => setIsNewMessageOpen(false)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Close new message panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </label>
              </div>

              <div className="max-h-64 overflow-y-auto px-2 pb-2">
                <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Available conversations
                </p>
                {filteredActiveChats.length > 0 ? (
                  <div className="space-y-1">
                    {filteredActiveChats.map((chat) => (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => openConversation(chat.id)}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF3F7] text-sm font-bold text-[#0B3A53] dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]">
                          {chat.adviserName.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{chat.adviserName}</span>
                          <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{chat.title}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <MessageSquareText className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {activeChats.length === 0 ? "No conversations available yet" : "No matching conversations"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {activeChats.length === 0
                        ? "Accept an adviser invitation before starting a message."
                        : "Try searching by adviser or conversation name."}
                    </p>
                  </div>
                )}
              </div>

              <p className="bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                Students can message only advisers and research conversations they have joined.
              </p>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          <section aria-labelledby="chat-invitations-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="chat-invitations-heading" className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <Inbox className="h-4 w-4 text-[#C58A18]" />
                Invitations
              </h3>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                {pendingInvitations.length}
              </span>
            </div>

            <div className="space-y-3">
              {pendingInvitations.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  No pending chat invitations.
                </p>
              ) : (
                pendingInvitations.map((invitation) => {
                  const targetChat = chats.find((chat) => chat.id === invitation.groupChatId);
                  if (!targetChat) return null;
                  return (
                    <article key={invitation.id} className="rounded-xl bg-amber-50/70 p-4 dark:bg-amber-400/[0.08]">
                      <p className="truncate text-sm font-bold text-[#0B3A53] dark:text-white">{targetChat.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                        {targetChat.description || "No description provided."}
                      </p>
                      <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">
                        Invited by <span className="font-semibold text-slate-700 dark:text-slate-200">{targetChat.adviserName}</span>
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecline(invitation.id)}
                          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                        >
                          <X className="h-4 w-4" />
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAccept(invitation.id)}
                          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#FFA400] px-3 text-xs font-bold text-[#072A3D] transition-colors hover:bg-[#E09000]"
                        >
                          <Check className="h-4 w-4" />
                          Accept
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section aria-labelledby="active-chats-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="active-chats-heading" className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <Users className="h-4 w-4 text-[#0B3A53] dark:text-[#38bdf8]" />
                Active chats
              </h3>
              <span className="rounded-full bg-[#EAF3F7] px-2 py-1 text-xs font-bold text-[#0B3A53] dark:bg-[#38bdf8]/10 dark:text-[#38bdf8]">
                {activeChats.length}
              </span>
            </div>

            <div className="space-y-2">
              {activeChats.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  Accepted conversations will appear here.
                </p>
              ) : (
                activeChats.map((chat) => {
                  const isSelected = chat.id === activeChatId;
                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => openConversation(chat.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                        isSelected
                          ? "bg-[#DDEBF1] text-[#0B3A53] dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isSelected
                          ? "bg-[#0B3A53] text-white dark:bg-[#38bdf8] dark:text-[#080E18]"
                          : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                      }`}>
                        {chat.title.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{chat.title}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                          Adviser: {chat.adviserName}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </aside>

      <div className="flex min-h-[520px] min-w-0 flex-col bg-slate-50/40 dark:bg-[#0D1525]/50 lg:min-h-0">
        {activeChat ? (
          <>
            <header className="flex min-h-20 shrink-0 items-center justify-between gap-4 bg-white px-4 py-4 dark:bg-[#101B2B] sm:px-6">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-[#0B3A53] dark:text-white">{activeChat.title}</h3>
                <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">Adviser: {activeChat.adviserName}</p>
              </div>
              <span className="hidden rounded-full bg-[#EAF3F7] px-3 py-1 text-xs font-bold text-[#0B3A53] dark:bg-[#38bdf8]/10 dark:text-[#38bdf8] sm:inline-flex">
                Group thread
              </span>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
              {activeChatMessages.length === 0 && (
                <div className="m-auto flex max-w-sm flex-col items-center py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#38bdf8]">
                    <MessageSquareText className="h-6 w-6" />
                  </div>
                  <h4 className="mt-4 text-base font-bold text-[#0B3A53] dark:text-white">Start the conversation</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Send the first message to your adviser and research group.
                  </p>
                </div>
              )}

              {activeChatMessages.map((message) => {
                const isSelf = message.senderId === studentEmail;
                return (
                  <div
                    key={message.id}
                    className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[75%] ${isSelf ? "self-end items-end" : "self-start items-start"}`}
                  >
                    <span className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {message.senderName} ({message.senderRole})
                    </span>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                      isSelf
                        ? "rounded-br-md bg-[#0B3A53] text-white"
                        : "rounded-bl-md bg-white text-slate-800 shadow-xs dark:bg-[#101B2B] dark:text-slate-100"
                    }`}>
                      {message.message}
                    </div>
                    <span className="px-1 text-xs text-slate-400">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>

            {(() => {
              const isAccepted = activeInvitationForChat?.status === "accepted";
              return (
                <form onSubmit={handleSendMessage} className="shrink-0 bg-white p-4 dark:bg-[#101B2B] sm:p-6">
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-2 dark:bg-white/[0.06]">
                    <input
                      type="text"
                      placeholder={isAccepted ? "Type a message..." : "Accept the invitation to participate in this chat."}
                      disabled={!isAccepted}
                      value={msgInput}
                      onChange={(event) => setMsgInput(event.target.value)}
                      className="h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0 disabled:cursor-not-allowed dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={!isAccepted || !msgInput.trim()}
                      className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FFA400] px-4 text-sm font-bold text-[#072A3D] transition-colors hover:bg-[#E09000] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="hidden sm:inline">Send</span>
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              );
            })()}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#38bdf8]">
                <MessageSquareText className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight text-[#0B3A53] dark:text-white">Select a conversation</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Choose a conversation from the left panel to view and send messages.
              </p>
              <button
                type="button"
                onClick={() => setIsNewMessageOpen(true)}
                className="mx-auto mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B3A53] px-5 text-sm font-bold text-white transition-colors hover:bg-[#072A3D] dark:bg-[#38bdf8] dark:text-[#080E18]"
              >
                <MessageSquarePlus className="h-5 w-5" />
                New message
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
