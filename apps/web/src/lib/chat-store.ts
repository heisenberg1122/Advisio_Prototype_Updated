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
  chats: [],
  invitations: [],
  messages: [],
  notifications: []
};

import { apiClient } from "./api-client";
import { realtimeClient } from "./realtime/sse-client";

export function getChatStore(): ChatStoreData {
  if (IS_SERVER) return DEFAULT_DATA;
  const stored = localStorage.getItem("advisio_chat_store");
  if (!stored) {
    return DEFAULT_DATA;
  }
  try {
    const parsed = JSON.parse(stored);
    if (parsed && Array.isArray(parsed.chats)) {
      // Filter out legacy prototype dummy chats
      parsed.chats = parsed.chats.filter((c: any) => c.id !== "chat-1" && !c.title?.includes("Group AI-CCS-01"));
      parsed.invitations = (parsed.invitations || []).filter((i: any) => i.groupChatId !== "chat-1");
      parsed.messages = (parsed.messages || []).filter((m: any) => m.groupChatId !== "chat-1");
      return parsed;
    }
    return DEFAULT_DATA;
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
