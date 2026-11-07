import { createHash } from "node:crypto";
import { createClient } from "redis";

export interface AssistantLimits {
  requestsPerMinute: number;
  dailyUserTokens: number;
  dailyGlobalTokens: number;
  maxConcurrent: number;
}
export const reserveAssistantTokensLua = `
local amount=tonumber(ARGV[1])
if tonumber(redis.call('GET',KEYS[1]) or '0')+amount>tonumber(ARGV[2]) then return 0 end
if tonumber(redis.call('GET',KEYS[2]) or '0')+amount>tonumber(ARGV[3]) then return 0 end
redis.call('INCRBY',KEYS[1],amount); redis.call('EXPIRE',KEYS[1],172800)
redis.call('INCRBY',KEYS[2],amount); redis.call('EXPIRE',KEYS[2],172800)
return 1
`;

export class AssistantQuota {
  private requests = new Map<string, { count: number; expires: number }>();
  private daily = new Map<string, number>();
  private day = "";
  private active = new Set<string>();
  private client?: ReturnType<typeof createClient>;
  private connecting?: Promise<unknown>;

  constructor(
    private config: AssistantLimits,
    private redisUrl?: string,
    private production = false,
  ) {}

  request(scope: string, now = Date.now()) {
    for (const [key, value] of this.requests)
      if (value.expires <= now) this.requests.delete(key);
    const entry = this.requests.get(scope) || {
      count: 0,
      expires: now + 60_000,
    };
    if (
      entry.count >= this.config.requestsPerMinute ||
      (this.requests.size >= 5000 && !this.requests.has(scope))
    )
      return Math.max(1, Math.ceil((entry.expires - now) / 1000));
    entry.count++;
    this.requests.set(scope, entry);
    return 0;
  }

  async reserve(
    scope: string,
    tokens: number,
    now = Date.now(),
  ): Promise<"ok" | "busy" | "budget" | "unavailable"> {
    if (this.active.has(scope) || this.active.size >= this.config.maxConcurrent)
      return "busy";
    // Reserve the slot before awaiting a shared store so concurrent requests cannot slip through.
    this.active.add(scope);
    try {
      const day = new Date(now).toISOString().slice(0, 10);
      if (this.redisUrl) {
        this.client ??= createClient({
          url: this.redisUrl,
          socket: { connectTimeout: 1500, reconnectStrategy: false },
          disableOfflineQueue: true,
        }).on("error", () => {});
        if (!this.client.isOpen) {
          this.connecting ??= this.client.connect().finally(() => {
            this.connecting = undefined;
          });
          await this.connecting;
        }
        const hash = createHash("sha256").update(scope).digest("hex");
        const prefix = "advisio:{researcher-assistant}:" + day;
        const reserved = await this.client.eval(reserveAssistantTokensLua, {
          keys: [prefix + ":user:" + hash, prefix + ":global"],
          arguments: [
            String(tokens),
            String(this.config.dailyUserTokens),
            String(this.config.dailyGlobalTokens),
          ],
        });
        if (reserved === 1) return "ok";
        this.active.delete(scope);
        return "budget";
      }
      if (this.production) {
        this.active.delete(scope);
        return "unavailable";
      }
      if (this.day !== day) {
        this.day = day;
        this.daily.clear();
      }
      const userTokens = this.daily.get(scope) || 0;
      const globalTokens = this.daily.get("*") || 0;
      if (
        userTokens + tokens > this.config.dailyUserTokens ||
        globalTokens + tokens > this.config.dailyGlobalTokens ||
        (this.daily.size >= 5000 && !this.daily.has(scope))
      ) {
        this.active.delete(scope);
        return "budget";
      }
      this.daily.set(scope, userTokens + tokens);
      this.daily.set("*", globalTokens + tokens);
      return "ok";
    } catch {
      this.active.delete(scope);
      return "unavailable";
    }
  }

  release(scope: string) {
    this.active.delete(scope);
  }
  async close() {
    if (this.client?.isOpen) await this.client.close();
  }
}
