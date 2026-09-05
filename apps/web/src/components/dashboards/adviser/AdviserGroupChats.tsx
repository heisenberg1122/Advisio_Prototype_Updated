"use client";

import React, { useState, useEffect } from "react";
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

  // Dynamic student list under assigned research groups
  const [assignedStudents, setAssignedStudents] = useState<Array<{ email: string; name: string; group: string }>>([]);

  // Local component states synced with localStorage store
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [invitations, setInvitations] = useState<GroupChatInvitation[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Group chat builder form states
  const [chatTitle, setChatTitle] = useState("");
  const [chatDescription, setChatDescription] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [msgInput, setMsgInput] = useState("");

  const syncWithStore = () => {
    const store = getChatStore();
    setChats(store.chats.filter(c => c.createdByAdviserId === adviserEmail));
    setInvitations(store.invitations);
    setMessages(store.messages);
  };

  useEffect(() => {
    syncWithStore();

    const fetchRealStudents = async () => {
      try {
        const res = await apiClient.get<{ projects: any[] }>("/api/research");
        if (res?.projects && Array.isArray(res.projects)) {
          const list: Array<{ email: string; name: string; group: string }> = [];
          res.projects.forEach((p) => {
            const grpName = p.title?.substring(0, 20) || "Research Group";
            p.members?.forEach((m: any) => {
              if (m.user?.email && !list.some((existing) => existing.email === m.user.email)) {
                list.push({
                  email: m.user.email,
                  name: `${m.user.firstName || ""} ${m.user.lastName || ""}`.trim() || m.user.email,
                  group: grpName,
                });
              }
            });
          });
          setAssignedStudents(list);
        }
      } catch (e) {
        // Fallback
      }
    };
    fetchRealStudents();

    // Listen for storage updates (for real-time sync between browser tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "advisio_chat_store") {
        syncWithStore();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [adviserEmail]);

  const handleStudentSelectToggle = (email: string) => {
    setSelectedStudents(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleSelectAllGroup = () => {
    const groupStudentEmails = assignedStudents
      .filter(s => s.group === selectedGroup)
      .map(s => s.email);
    setSelectedStudents(groupStudentEmails);
  };

  const handleCreateChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatTitle.trim() || selectedStudents.length === 0) {
      triggerToast("Please enter a title and select at least one student.");
      return;
    }

    const store = getChatStore();
    const newChatId = "chat-" + Date.now();

    const newChat: GroupChat = {
      id: newChatId,
      title: chatTitle,
      description: chatDescription,
      createdByAdviserId: adviserEmail,
      adviserName: adviserName,
      relatedResearchGroupId: selectedGroup || undefined,
      createdAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    };

    // Add chat
    store.chats.push(newChat);

    // Create invitations
    selectedStudents.forEach(email => {
      const studentName = assignedStudents.find(s => s.email === email)?.name || email;
      const invId = "inv-" + Math.random().toString(36).substr(2, 9);
      
      const newInv: GroupChatInvitation = {
        id: invId,
        groupChatId: newChatId,
        studentId: email,
        studentName: studentName,
        invitedByAdviserId: adviserEmail,
        status: "pending",
        invitedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      };

      store.invitations.push(newInv);

      // Create notification for student
      store.notifications.push({
        id: "notif-" + Math.random().toString(36).substr(2, 9),
        userId: email,
        msg: `You have been invited to join a group chat by ${adviserName}.`,
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        read: false
      });
    });

    saveChatStore(store);
    syncWithStore();

    // Reset inputs
    setChatTitle("");
    setChatDescription("");
    setSelectedStudents([]);
    setActiveChatId(newChatId);

    triggerToast(`Group Chat "${chatTitle}" created and invitations dispatched.`);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatId || !msgInput.trim()) return;

    const store = getChatStore();
    const newMsg: GroupChatMessage = {
      id: "msg-" + Date.now(),
      groupChatId: activeChatId,
      senderId: adviserEmail,
      senderName: adviserName,
      senderRole: "adviser",
      message: msgInput,
      createdAt: new Date().toISOString(),
    };

    store.messages.push(newMsg);
    saveChatStore(store);
    setMsgInput("");
    syncWithStore();
  };

  const handleRemoveMember = (invId: string) => {
    const store = getChatStore();
    const inv = store.invitations.find(i => i.id === invId);
    if (!inv) return;

    store.invitations = store.invitations.filter(i => i.id !== invId);
    saveChatStore(store);
    syncWithStore();
    triggerToast(`Removed student ${inv.studentName} from the thread.`);
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const activeChatMessages = messages.filter(m => m.groupChatId === activeChatId);
  const activeChatInvitations = invitations.filter(i => i.groupChatId === activeChatId);
  
  // Accepted members list
  const acceptedEmails = activeChatInvitations
    .filter(i => i.status === "accepted")
    .map(i => i.studentId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-slate-800">
      
      {/* ─── LEFT COLUMN: CHAT LIST & CREATOR (5 cols) ─── */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        
        {/* CREATE CHAT CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <h3 className="font-extrabold text-[#1b4264] text-[15px] flex items-center gap-2 border-b border-slate-100 pb-3">
            <i className="ti ti-plus text-[#ffa400] text-lg" />
            Create Group Chat Thread
          </h3>

          <form onSubmit={handleCreateChat} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group Chat Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Chapter 3 Methodology Q&A"
                value={chatTitle}
                onChange={(e) => setChatTitle(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-[12.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Topic Description</label>
              <textarea
                rows={2}
                placeholder="Brief guidelines or discussion scope..."
                value={chatDescription}
                onChange={(e) => setChatDescription(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-[12.5px] text-slate-900 focus:outline-none focus:border-[#ffa400] transition resize-none"
              />
            </div>

            <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 p-3 rounded-lg">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                <span className="text-[10.5px] font-extrabold text-[#1b4264]">Select Cohort Group</span>
                <button
                  type="button"
                  onClick={handleSelectAllGroup}
                  className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Select All
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {assignedStudents.map((student) => {
                  const isChecked = selectedStudents.includes(student.email);
                  return (
                    <label
                      key={student.email}
                      className="flex items-center gap-2.5 text-[11.5px] text-slate-700 cursor-pointer select-none hover:text-slate-900"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleStudentSelectToggle(student.email)}
                        className="w-3.5 h-3.5 border-slate-350 bg-white rounded text-blue-600 focus:ring-0 cursor-pointer accent-[#ffa400]"
                      />
                      <span>
                        <strong>{student.name}</strong> ({student.email})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg text-[12px] shadow-sm cursor-pointer transition flex items-center justify-center gap-1.5 border border-[#ffa400]"
            >
              <i className="ti ti-send" /> Send Chat Invitations
            </button>
          </form>
        </div>

        {/* CHATS LIST CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <h3 className="font-extrabold text-[#1b4264] text-[15px] flex items-center gap-2 border-b border-slate-100 pb-3">
            <i className="ti ti-messages text-[#ffa400] text-lg" />
            Active Chat Threads ({chats.length})
          </h3>

          <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
            {chats.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-[11.5px] italic">
                No active chat threads created yet.
              </div>
            ) : (
              chats.map((c) => {
                const isSelected = c.id === activeChatId;
                const membersCount = invitations.filter(i => i.groupChatId === c.id && i.status === "accepted").length;
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
                        {c.description || "No description provided"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? "bg-white/20 text-[#ffa400]" : "bg-[#1b4264]/10 text-[#1b4264]"
                      }`}>
                        {membersCount} joined
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ─── RIGHT COLUMN: ACTIVE CHAT ROOM & MEMBERS (7 cols) ─── */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        {activeChat ? (
          <>
            {/* CHAT INTERACTIVE PANEL */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[550px]">
              {/* Chat Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-[#1b4264] rounded-t-xl text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="font-extrabold text-[14px]">{activeChat.title}</h3>
                  <p className="text-[10.5px] text-slate-300 mt-0.5">{activeChat.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] uppercase font-bold tracking-wider text-[#ffa400]">
                    Chat Room
                  </span>
                </div>
              </div>

              {/* Messages viewport */}
              <div className="flex-1 p-5 overflow-y-auto bg-slate-50 flex flex-col gap-4">
                {activeChatMessages.length === 0 ? (
                  <div className="my-auto text-center text-slate-400 text-xs italic">
                    Welcome to the thread! Send a message to start the advising session.
                  </div>
                ) : (
                  activeChatMessages.map((m) => {
                    const isSelf = m.senderId === adviserEmail;
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
                  })
                )}
              </div>

              {/* Message composer */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 bg-white flex gap-2.5 items-center flex-shrink-0 rounded-b-xl">
                <input
                  type="text"
                  placeholder={
                    acceptedEmails.length === 0
                      ? "Wait for at least one student to accept invitation..."
                      : "Type your advising message here..."
                  }
                  disabled={acceptedEmails.length === 0}
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  className="bg-white border border-slate-350 rounded-lg p-2.5 text-xs flex-1 focus:outline-none focus:border-[#ffa400] disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={acceptedEmails.length === 0 || !msgInput.trim()}
                  className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg text-xs border border-[#ffa400] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </form>
            </div>

            {/* MEMBERS & INVITATION STATUS TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
              <h3 className="font-extrabold text-[#1b4264] text-[14px] flex items-center gap-2 border-b border-slate-100 pb-2">
                <i className="ti ti-users text-[#ffa400] text-base" />
                Invitation & Membership Status
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9.5px]">
                      <th className="pb-2">Student Name & Email</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeChatInvitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5">
                          <span className="font-bold text-[#1b4264] block">{inv.studentName}</span>
                          <span className="text-[10px] text-slate-400">{inv.studentId}</span>
                        </td>
                        <td className="py-2.5">
                          <Tag variant={inv.status === "accepted" ? "success" : inv.status === "pending" ? "warn" : "danger"}>
                            {inv.status}
                          </Tag>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleRemoveMember(inv.id)}
                            className="px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
            <div className="w-12 h-12 rounded-full bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center mb-4">
              <i className="ti ti-messages text-xl" />
            </div>
            <h3 className="font-extrabold text-[#1b4264] text-[15px]">No active thread selected</h3>
            <p className="text-[11px] text-slate-400 max-w-xs mt-1">
              Select one of your active threads from the left panel, or construct a new thread to launch advising dialogs.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
