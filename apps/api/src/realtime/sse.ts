import { Response } from "express";

export interface SSEClient {
  id: string;
  userId?: string;
  res: Response;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    // Send keep-alive ping every 25 seconds to keep HTTP connections active through proxies
    this.heartbeatTimer = setInterval(() => {
      this.broadcastRaw(": ping\n\n");
    }, 25000);
  }

  public addClient(client: SSEClient) {
    this.clients.set(client.id, client);

    // Initial connection handshake
    client.res.write(`event: connected\ndata: ${JSON.stringify({ clientId: client.id, timestamp: new Date().toISOString() })}\n\n`);

    client.res.on("close", () => {
      this.removeClient(client.id);
    });
  }

  public removeClient(clientId: string) {
    this.clients.delete(clientId);
  }

  public getActiveCount(): number {
    return this.clients.size;
  }

  public broadcastRaw(rawMessage: string) {
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(rawMessage);
      } catch (err) {
        console.error(`Error sending raw SSE to client ${id}:`, err);
        this.removeClient(id);
      }
    }
  }

  public broadcastEvent(eventType: string, data: any) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch (err) {
        console.error(`Error sending SSE event '${eventType}' to client ${id}:`, err);
        this.removeClient(id);
      }
    }
  }

  public sendToUser(userId: string, eventType: string, data: any) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (client.userId === userId) {
        try {
          client.res.write(payload);
        } catch (err) {
          console.error(`Error sending targeted SSE event to client ${id}:`, err);
          this.removeClient(id);
        }
      }
    }
  }
}

export const sseManager = new SSEManager();
