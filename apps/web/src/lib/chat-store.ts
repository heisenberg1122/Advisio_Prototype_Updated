export interface GroupChat {
  id: string;
  title: string;
  description: string;
  createdByAdviserId: string;
  adviserName: string;
  relatedResearchGroupId?: string;
  createdAt: string;
}

export interface GroupChatInvitation {
  id: string;
  groupChatId: string;
  studentId: string; // "juan.reyes@university.edu.ph"
  studentName: string;
  invitedByAdviserId: string;
  status: "pending" | "accepted" | "declined";
  invitedAt: string;
  respondedAt?: string;
}

export interface GroupChatMessage {
  id: string;
  groupChatId: string;
  senderId: string;
  senderName: string;
  senderRole: "student" | "adviser";
  message: string;
  createdAt: string;
}

export interface ChatNotification {
  id: string;
  userId: string; // Target email (e.g. juan.reyes... or rachel.lim...)
  msg: string;
  date: string;
  read: boolean;
}

export interface ChatStoreData {
  chats: GroupChat[];
  invitations: GroupChatInvitation[];
  messages: GroupChatMessage[];
  notifications: ChatNotification[];
}

const IS_SERVER = typeof window === "undefined";

const DEFAULT_DATA: ChatStoreData = {
  chats: [
    {
      id: "chat-1",
      title: "Group AI-CCS-01 Thread",
      description: "Discussion for AI Crop Yield Prediction System",
      createdByAdviserId: "rachel.lim@university.edu.ph",
      adviserName: "Dr. Rachel Lim",
      relatedResearchGroupId: "Group AI-CCS-01",
      createdAt: "June 28, 2026",
    }
  ],
  invitations: [
    {
      id: "inv-1",
      groupChatId: "chat-1",
      studentId: "juan.reyes@university.edu.ph",
      studentName: "Juan Reyes",
      invitedByAdviserId: "rachel.lim@university.edu.ph",
      status: "accepted",
      invitedAt: "June 28, 2026",
      respondedAt: "June 28, 2026",
    },
    {
      id: "inv-2",
      groupChatId: "chat-1",
      studentId: "marc.santos@university.edu.ph",
      studentName: "Marc Santos",
      invitedByAdviserId: "rachel.lim@university.edu.ph",
      status: "pending",
      invitedAt: "June 28, 2026",
    }
  ],
  messages: [
    {
      id: "msg-1",
      groupChatId: "chat-1",
      senderId: "rachel.lim@university.edu.ph",
      senderName: "Dr. Rachel Lim",
      senderRole: "adviser",
      message: "Hello everyone, please post your updates for Chapter 1-3 draft in this thread.",
      createdAt: "2026-06-28T10:00:00Z"
    },
    {
      id: "msg-2",
      groupChatId: "chat-1",
      senderId: "juan.reyes@university.edu.ph",
      senderName: "Juan Reyes",
      senderRole: "student",
      message: "Hi Dr. Lim! We have updated the dataset split and will upload the v2 draft shortly.",
      createdAt: "2026-06-28T10:15:00Z"
    }
  ],
  notifications: []
};

import { apiClient } from "./api-client";
import { realtimeClient } from "./realtime/sse-client";

export function getChatStore(): ChatStoreData {
  if (IS_SERVER) return DEFAULT_DATA;
  const stored = localStorage.getItem("advisio_chat_store");
  if (!stored) {
    localStorage.setItem("advisio_chat_store", JSON.stringify(DEFAULT_DATA));
    return DEFAULT_DATA;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_DATA;
  }
}

export function saveChatStore(data: ChatStoreData) {
  if (IS_SERVER) return;
  localStorage.setItem("advisio_chat_store", JSON.stringify(data));
}

// Auto-subscribe to SSE real-time chat messages
if (!IS_SERVER) {
  realtimeClient.on<GroupChatMessage>("chat:message", (newMessage) => {
    if (!newMessage || !newMessage.id) return;
    const current = getChatStore();
    if (!current.messages.some((m) => m.id === newMessage.id)) {
      current.messages.push(newMessage);
      saveChatStore(current);
      window.dispatchEvent(new CustomEvent("advisio:chat_updated", { detail: newMessage }));
    }
  });

  realtimeClient.on<GroupChat>("chat:created", (newChat) => {
    if (!newChat || !newChat.id) return;
    const current = getChatStore();
    if (!current.chats.some((c) => c.id === newChat.id)) {
      current.chats.push(newChat);
      saveChatStore(current);
      window.dispatchEvent(new CustomEvent("advisio:chat_updated", { detail: newChat }));
    }
  });

  realtimeClient.on<GroupChatInvitation>("chat:invitation", (newInv) => {
    if (!newInv || !newInv.id) return;
    const current = getChatStore();
    if (!current.invitations.some((i) => i.id === newInv.id)) {
      current.invitations.push(newInv);
      saveChatStore(current);
      window.dispatchEvent(new CustomEvent("advisio:chat_updated", { detail: newInv }));
    }
  });
}

export async function fetchRemoteChatStore(): Promise<ChatStoreData> {
  try {
    const data = await apiClient.get<ChatStoreData>("/api/chats");
    if (data && data.chats) {
      saveChatStore(data);
      return data;
    }
  } catch {
    // Fallback to local cache
  }
  return getChatStore();
}

export async function sendRemoteChatMessage(
  chatId: string,
  message: string,
  senderName?: string,
  senderRole?: "student" | "adviser"
): Promise<GroupChatMessage | null> {
  try {
    const res = await apiClient.post<{ message: GroupChatMessage }>(`/api/chats/${chatId}/messages`, {
      message,
      senderName,
      senderRole,
    });
    return res.message;
  } catch (err) {
    console.warn("Failed to send message to backend:", err);
    return null;
  }
}
