type SSECallback<T = any> = (data: T) => void;
export type RealtimeConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

class RealtimeClient {
  private abortController: AbortController | null = null;
  private listeners: Map<string, Set<SSECallback>> = new Map();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private lastEventId = "";

  public connect() {
    if (typeof window === "undefined" || this.abortController || this.isConnecting) return;
    void this.openStream();
  }

  private async openStream() {
    this.isConnecting = true;
    this.dispatch("connection:state", { state: this.reconnectAttempts ? "reconnecting" : "connecting" });
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const token = localStorage.getItem("advisio_token");
      const response = await fetch(`${API_BASE_URL}/api/realtime/events`, {
        headers: {
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(this.lastEventId ? { "Last-Event-ID": this.lastEventId } : {}),
        },
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error(`Realtime connection failed (${response.status})`);

      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.dispatch("connection:state", { state: "connected" });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          this.handleEventBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
      }

      if (!controller.signal.aborted) this.scheduleReconnect();
    } catch (error) {
      if (!controller.signal.aborted) {
        console.warn("Realtime stream disconnected:", error);
        this.scheduleReconnect();
      }
    } finally {
      if (this.abortController === controller) this.abortController = null;
      this.isConnecting = false;
    }
  }

  private handleEventBlock(block: string) {
    if (!block || block.startsWith(":")) return;
    let eventType = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) eventType = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      else if (line.startsWith("id:")) this.lastEventId = line.slice(3).trim();
    }
    if (!dataLines.length) return;
    const rawData = dataLines.join("\n");
    try {
      this.dispatch(eventType, JSON.parse(rawData));
    } catch {
      this.dispatch(eventType, rawData);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    const online = typeof navigator === "undefined" || navigator.onLine;
    this.dispatch("connection:state", { state: online ? "reconnecting" : "offline" });
    const baseDelay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempts);
    const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
    this.reconnectAttempts += 1;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  public on<T = any>(eventType: string, callback: SSECallback<T>) {
    if (!this.listeners.has(eventType)) this.listeners.set(eventType, new Set());
    this.listeners.get(eventType)!.add(callback as SSECallback);
    this.connect();
    return () => this.off(eventType, callback);
  }

  public off(eventType: string, callback: SSECallback) {
    const listeners = this.listeners.get(eventType);
    listeners?.delete(callback);
    if (listeners?.size === 0) this.listeners.delete(eventType);
  }

  private dispatch(eventType: string, data: any) {
    this.listeners.get(eventType)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in realtime handler for ${eventType}:`, error);
      }
    });
  }

  public disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.abortController?.abort();
    this.abortController = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.dispatch("connection:state", { state: "offline" });
  }
}

export const realtimeClient = new RealtimeClient();
