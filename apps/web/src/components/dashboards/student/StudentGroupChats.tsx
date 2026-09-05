"use client";

import React, { useState, useEffect } from "react";
import { getChatStore, saveChatStore, GroupChat, GroupChatInvitation, GroupChatMessage } from "@/lib/chat-store";
import { useAuth } from "@/providers/auth-provider";
import { Tag } from "@/components/ui/Tag";

interface StudentGroupChatsProps {
  triggerToast: (msg: string) => void;
}

export function StudentGroupChats({ triggerToast }: StudentGroupChatsProps) {
  const { user } = useAuth();
  const studentEmail = user?.email || "";
  const studentName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Student Researcher";

  // Shared store state
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [invitations, setInvitations] = useState<GroupChatInvitation[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [msgInput, setMsgInput] = useState("");

  const syncWithStore = () => {
    const store = getChatStore();
    setChats(store.chats);
    setInvitations(store.invitations.filter(i => i.studentId === studentEmail));
    setMessages(store.messages);
  };

  useEffect(() => {
    syncWithStore();

    // Storage listener for split-screen real-time updates
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "advisio_chat_store") {
        syncWithStore();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Accept Invitation Action
  const handleAccept = (invId: string) => {
    const store = getChatStore();
    const inv = store.invitations.find(i => i.id === invId);
    if (!inv) return;

    inv.status = "accepted";
    inv.respondedAt = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Send notification to adviser
    store.notifications.push({
      id: "notif-" + Math.random().toString(36).substr(2, 9),
      userId: inv.invitedByAdviserId,
      msg: `${studentName} has accepted your invitation to join the group chat.`,
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      read: false
    });

    saveChatStore(store);
    syncWithStore();
    setActiveChatId(inv.groupChatId);
    triggerToast("Invitation accepted! You joined the chat thread.");
  };

  // Decline Invitation Action
  const handleDecline = (invId: string) => {
    const store = getChatStore();
    const inv = store.invitations.find(i => i.id === invId);
    if (!inv) return;

    inv.status = "declined";
    inv.respondedAt = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Send notification to adviser
    store.notifications.push({
      id: "notif-" + Math.random().toString(36).substr(2, 9),
      userId: inv.invitedByAdviserId,
      msg: `${studentName} has declined your invitation to join the group chat.`,
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      read: false
    });

    saveChatStore(store);
    syncWithStore();
    if (activeChatId === inv.groupChatId) {
      setActiveChatId(null);
    }
    triggerToast("Invitation declined.");
  };

  // Send Message Action
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatId || !msgInput.trim()) return;

    const store = getChatStore();
    const activeInvitation = store.invitations.find(
      i => i.groupChatId === activeChatId && i.studentId === studentEmail
    );

    // Security check: cannot message unless accepted
    if (!activeInvitation || activeInvitation.status !== "accepted") {
      triggerToast("Cannot send message: Invitation not accepted.");
      return;
    }

    const newMsg: GroupChatMessage = {
      id: "msg-" + Date.now(),
      groupChatId: activeChatId,
      senderId: studentEmail,
      senderName: studentName,
      senderRole: "student",
      message: msgInput,
      createdAt: new Date().toISOString(),
    };

    store.messages.push(newMsg);
    saveChatStore(store);
    setMsgInput("");
    syncWithStore();
  };

  // Filter invitations to show pending ones
  const pendingInvs = invitations.filter(i => i.status === "pending");
  const acceptedInvs = invitations.filter(i => i.status === "accepted");

  // Chats corresponding to student's invitations
  const activeChats = chats.filter(c => 
    acceptedInvs.some(i => i.groupChatId === c.id)
  );

  const activeChat = chats.find(c => c.id === activeChatId);
  const activeInvitationForChat = invitations.find(i => i.groupChatId === activeChatId);

  // Messages of the active chat
  const activeChatMessages = messages.filter(m => m.groupChatId === activeChatId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-slate-800">
      
      {/* ─── LEFT COLUMN: INVITATIONS & ACTIVE CHAT LIST (5 cols) ─── */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        
        {/* PENDING INVITATIONS CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <h3 className="font-extrabold text-[#1b4264] text-[15px] flex items-center gap-2 border-b border-slate-100 pb-3">
            <i className="ti ti-mail-opened text-[#ffa400] text-lg" />
            Group Chat Invitations ({pendingInvs.length})
          </h3>

          <div className="flex flex-col gap-3">
            {pendingInvs.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-[11.5px] italic">
                No pending chat invitations from your adviser.
              </div>
            ) : (
              pendingInvs.map((inv) => {
                const targetChat = chats.find(c => c.id === inv.groupChatId);
                if (!targetChat) return null;
                return (
                  <div key={inv.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3 shadow-sm">
                    <div>
                      <span className="font-extrabold text-[#1b4264] text-[13px] block">{targetChat.title}</span>
                      <p className="text-[10.5px] text-slate-450 mt-1 leading-relaxed">{targetChat.description || "No description provided."}</p>
                      <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                        Invited by: <strong>{targetChat.adviserName}</strong>
                      </span>
                    </div>

                    <div className="flex gap-2 border-t border-slate-200 pt-2.5 mt-1">
                      <button
                        onClick={() => handleDecline(inv.id)}
                        className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-lg text-[11px] cursor-pointer transition-colors"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAccept(inv.id)}
                        className="flex-1 py-1.5 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg text-[11px] border border-[#ffa400] cursor-pointer transition-colors"
                      >
                        Accept & Join
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ACTIVE CHATS LIST CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <h3 className="font-extrabold text-[#1b4264] text-[15px] flex items-center gap-2 border-b border-slate-100 pb-3">
            <i className="ti ti-messages text-[#ffa400] text-lg" />
            My Active Chats ({activeChats.length})
          </h3>

          <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
            {activeChats.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-[11.5px] italic">
                Accept invitations above to populate active group chats.
              </div>
            ) : (
              activeChats.map((c) => {
                const isSelected = c.id === activeChatId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveChatId(c.id)}
                    className={`p-3.5 border rounded-lg flex justify-between items-center cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#1b4264] text-white border-[#1b4264]"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-[12.5px] block">{c.title}</span>
                      <span className={`text-[10px] ${isSelected ? "text-slate-200" : "text-slate-400"} mt-0.5 block`}>
                        Adviser: {c.adviserName}
                      </span>
                    </div>
                    <i className={`ti ti-chevron-right text-xs ${isSelected ? "text-[#ffa400]" : "text-slate-400"}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ─── RIGHT COLUMN: ACTIVE CHAT ROOM (7 cols) ─── */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        {activeChat ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[550px]">
            {/* Chat Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-[#1b4264] rounded-t-xl text-white flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="font-extrabold text-[14px]">{activeChat.title}</h3>
                <p className="text-[10.5px] text-slate-300 mt-0.5">Adviser: {activeChat.adviserName}</p>
              </div>
              <span className="text-[9.5px] uppercase font-bold tracking-wider text-[#ffa400]">
                Group Thread
              </span>
            </div>

            {/* Messages Viewport */}
            <div className="flex-1 p-5 overflow-y-auto bg-slate-50 flex flex-col gap-4">
              {activeChatMessages.map((m) => {
                const isSelf = m.senderId === studentEmail;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[80%] gap-1 ${isSelf ? "self-end items-end" : "self-start items-start"}`}
                  >
                    <span className="text-[9px] font-bold text-slate-400">
                      {m.senderName} ({m.senderRole})
                    </span>
                    <div
                      className={`p-3 rounded-xl text-xs shadow-sm leading-relaxed ${
                        isSelf
                          ? "bg-[#1b4264] text-white rounded-tr-none"
                          : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                      }`}
                    >
                      {m.message}
                    </div>
                    <span className="text-[8.5px] text-slate-400">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Composer Box (Checks if accepted or pending) */}
            {(() => {
              const isAccepted = activeInvitationForChat?.status === "accepted";
              return (
                <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 bg-white flex gap-2.5 items-center flex-shrink-0 rounded-b-xl">
                  <input
                    type="text"
                    placeholder={
                      isAccepted
                        ? "Type your message to adviser/peers..."
                        : "You must accept the invitation to participate in this group chat."
                    }
                    disabled={!isAccepted}
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    className="bg-white border border-slate-350 rounded-lg p-2.5 text-xs flex-1 focus:outline-none focus:border-[#ffa400] disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={!isAccepted || !msgInput.trim()}
                    className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg text-xs border border-[#ffa400] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </form>
              );
            })()}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
            <div className="w-12 h-12 rounded-full bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center mb-4">
              <i className="ti ti-messages text-xl" />
            </div>
            <h3 className="font-extrabold text-[#1b4264] text-[15px]">No active chat selected</h3>
            <p className="text-[11px] text-slate-400 max-w-xs mt-1">
              Select one of your accepted chats on the left panel to join discussions, or accept pending invitations to activate threads.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
