import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";

export type AnalysisLimits = {
  rate: number;
  windowSeconds: number;
  daily: number;
  globalDaily: number;
  concurrent: number;
  leaseMilliseconds: number;
};

export type QuotaDecision =
  | { allowed: true; reservationId: string }
  | { allowed: false; code: string; retryAfter: number };

export interface AnalysisQuotaStore {
  acquire(clientId: string): Promise<QuotaDecision>;
  release(reservationId: string): Promise<void>;
  close(): Promise<void>;
}

const reserveScript = `
local clock = redis.call('TIME')
local seconds = tonumber(clock[1])
local now = seconds * 1000 + math.floor(tonumber(clock[2]) / 1000)
local dayRemaining = 86400 - (seconds % 86400)
local rateLimit = tonumber(ARGV[1])
local windowSeconds = tonumber(ARGV[2])
local dailyLimit = tonumber(ARGV[3])
local globalLimit = tonumber(ARGV[4])
local concurrencyLimit = tonumber(ARGV[5])
local leaseMilliseconds = tonumber(ARGV[6])
local reservationId = ARGV[7]

local function exceeded(key, limit, reason)
  if tonumber(redis.call('GET', key) or '0') >= limit then
    return {0, reason, math.max(1, redis.call('TTL', key))}
  end
end

local rejection = exceeded(KEYS[1], rateLimit, 1)
  or exceeded(KEYS[2], dailyLimit, 2)
  or exceeded(KEYS[3], globalLimit, 3)
if rejection then
  return rejection
end

redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', now)
if redis.call('ZCARD', KEYS[4]) >= concurrencyLimit then
  return {0, 4, 5}
end

local function increment(key, lifetime)
  if redis.call('INCR', key) == 1 then
    redis.call('EXPIRE', key, lifetime)
  end
end

increment(KEYS[1], windowSeconds)
increment(KEYS[2], dayRemaining)
increment(KEYS[3], dayRemaining)
redis.call('ZADD', KEYS[4], now + leaseMilliseconds, reservationId)
local latest = redis.call('ZRANGE', KEYS[4], -1, -1, 'WITHSCORES')
redis.call('PEXPIREAT', KEYS[4], tonumber(latest[2]) + 1000)
return {1, 0, 0}
`;

const rejectionCodes = [
  "RateLimitExceeded",
  "DailyLimitExceeded",
  "GlobalLimitExceeded",
  "AnalysisBusy"
];

export class RedisAnalysisQuotaStore implements AnalysisQuotaStore {
  private readonly redis: Redis;
  private readonly prefix: string;
  private connection?: Promise<void>;

  constructor(
    redisUrl: string,
    private readonly limits: AnalysisLimits,
    namespace = "jobfitproof"
  ) {
    this.prefix = `${namespace}:{analyses}`;
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      autoResendUnfulfilledCommands: false,
      retryStrategy: () => null
    });
    this.redis.on("error", () => {});
  }

  private async connect(): Promise<void> {
    if (this.redis.status === "ready") {
      return;
    }

    this.connection ??= this.redis.connect().finally(() => {
      this.connection = undefined;
    });
    await this.connection;
  }

  async acquire(clientId: string): Promise<QuotaDecision> {
    if (!/^[a-f0-9]{64}$/.test(clientId)) {
      throw new Error("Invalid quota identity");
    }

    await this.connect();
    const reservationId = randomUUID();
    const result = await this.redis.eval(
      reserveScript,
      4,
      `${this.prefix}:client:${clientId}:window`,
      `${this.prefix}:client:${clientId}:daily`,
      `${this.prefix}:global:daily`,
      `${this.prefix}:active`,
      this.limits.rate,
      this.limits.windowSeconds,
      this.limits.daily,
      this.limits.globalDaily,
      this.limits.concurrent,
      this.limits.leaseMilliseconds,
      reservationId
    );

    if (!Array.isArray(result) || result.length !== 3) {
      throw new Error("Invalid quota response");
    }

    const [allowed, reason, retryAfter] = result.map(Number);
    if (allowed === 1) {
      return { allowed: true, reservationId };
    }

    const code = rejectionCodes[reason - 1];
    if (allowed !== 0 || !code || !Number.isFinite(retryAfter) || retryAfter < 1) {
      throw new Error("Invalid quota response");
    }

    return { allowed: false, code, retryAfter };
  }

  async release(reservationId: string): Promise<void> {
    await this.connect();
    await this.redis.zrem(`${this.prefix}:active`, reservationId);
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }
}
