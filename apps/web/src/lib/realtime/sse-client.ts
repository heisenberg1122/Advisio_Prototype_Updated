type SSECallback<T = any> = (data: T) => void;

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<SSECallback>> = new Map();
  private reconnectTimeout: any = null;
  private isConnecting = false;

  public connect() {
    if (typeof window === "undefined" || this.eventSource || this.isConnecting) return;

    this.isConnecting = true;
    try {
      // Connect to the API SSE endpoint
      const es = new EventSource("/api/realtime/events", { withCredentials: true });

      es.onopen = () => {
        this.isConnecting = false;
        // Connected cleanly
      };

      es.onerror = () => {
        this.isConnecting = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Auto-reconnect after 5 seconds with exponential backoff
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 5000);
        }
      };

      this.eventSource = es;

      // Register default event listeners
      const knownEvents = [
        "connected",
        "chat:message",
        "chat:created",
        "chat:invitation",
        "chat:invitation_update",
        "consultation:update",
        "notification:new",
      ];

      knownEvents.forEach((eventType) => {
        es.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            this.dispatch(eventType, parsed);
          } catch {
            this.dispatch(eventType, e.data);
          }
        });
      });
    } catch (err) {
      this.isConnecting = false;
      console.warn("Realtime EventSource connection error:", err);
    }
  }

  public on<T = any>(eventType: string, callback: SSECallback<T>) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Auto-connect if not already connected
    this.connect();

    return () => {
      this.off(eventType, callback);
    };
  }

  public off(eventType: string, callback: SSECallback) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  private dispatch(eventType: string, data: any) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in realtime handler for ${eventType}:`, err);
        }
      });
    }
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const realtimeClient = new RealtimeClient();
