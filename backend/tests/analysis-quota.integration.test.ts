import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Redis } from "ioredis";
import { afterEach, describe, expect, it } from "vitest";
import { RedisAnalysisQuotaStore, type AnalysisLimits } from "../src/modules/analyses/analysis.quota.js";

const redisUrl = process.env.REDIS_TEST_URL;
const stores: RedisAnalysisQuotaStore[] = [];
const namespaces: string[] = [];
const limits: AnalysisLimits = {
  rate: 3, windowSeconds: 600, daily: 10, globalDaily: 50, concurrent: 2,
  leaseMilliseconds: 90_000
};

function store(overrides: Partial<AnalysisLimits> = {}, namespace = `jobfitproof-test-${randomUUID()}`) {
  namespaces.push(namespace);
  const quota = new RedisAnalysisQuotaStore(redisUrl!, { ...limits, ...overrides }, namespace);
  stores.push(quota);
  return { quota, namespace };
}

async function admitAndRelease(quota: RedisAnalysisQuotaStore, clientId = "b".repeat(64)) {
  const decision = await quota.acquire(clientId);
  if (decision.allowed) {
    await quota.release(decision.reservationId);
  }
  return decision;
}

afterEach(async () => {
  await Promise.all(stores.splice(0).map((quota) => quota.close()));
  if (redisUrl && namespaces.length) {
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 0 });
    try {
      for (const namespace of namespaces.splice(0)) {
        const keys = await redis.keys(`${namespace}:*`);
        if (keys.length) {
          await redis.del(...keys);
        }
      }
    } finally {
      redis.disconnect();
    }
  }
});

describe.skipIf(!redisUrl)("Redis analysis quotas", () => {
  it("enforces a shared rate limit across independent backend instances", async () => {
    const { quota: first, namespace } = store();
    const { quota: second } = store({}, namespace);
    await admitAndRelease(first);
    await admitAndRelease(second);
    await admitAndRelease(first);
    expect(await second.acquire("b".repeat(64))).toMatchObject({
      allowed: false, code: "RateLimitExceeded", retryAfter: expect.any(Number)
    });
  });

  it("retains the quota when an application connection is restarted", async () => {
    const { quota: first, namespace } = store({ rate: 1 });
    await admitAndRelease(first);
    await first.close();
    const { quota: restarted } = store({ rate: 1 }, namespace);
    expect(await restarted.acquire("b".repeat(64))).toMatchObject({ allowed: false, code: "RateLimitExceeded" });
  });

  it("enforces per-client daily quotas independently of short windows", async () => {
    const { quota } = store({ rate: 100, daily: 2 });
    await admitAndRelease(quota);
    await admitAndRelease(quota);
    expect(await quota.acquire("b".repeat(64))).toMatchObject({ allowed: false, code: "DailyLimitExceeded" });
    expect(await admitAndRelease(quota, "c".repeat(64))).toMatchObject({ allowed: true });
  });

  it("cannot overspend the global budget under concurrent reservations", async () => {
    const { quota: first, namespace } = store({ rate: 100, daily: 100, globalDaily: 5, concurrent: 100 });
    const { quota: second } = store({ rate: 100, daily: 100, globalDaily: 5, concurrent: 100 }, namespace);
    const decisions = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      (index % 2 ? first : second).acquire(index.toString(16).padStart(64, "0"))
    ));
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(5);
    expect(decisions.filter((decision) => !decision.allowed)).toEqual(
      Array.from({ length: 15 }, () => expect.objectContaining({ code: "GlobalLimitExceeded" }))
    );
  });

  it("limits global concurrency and allows work after a slot is released", async () => {
    const { quota } = store({ rate: 100, daily: 100 });
    const decisions = await Promise.all(Array.from({ length: 10 }, () => quota.acquire("b".repeat(64))));
    const admitted = decisions.filter((decision) => decision.allowed);
    expect(admitted).toHaveLength(2);
    expect(decisions.filter((decision) => !decision.allowed)).toEqual(
      Array.from({ length: 8 }, () => expect.objectContaining({ code: "AnalysisBusy" }))
    );
    await quota.release(admitted[0].reservationId);
    expect(await quota.acquire("b".repeat(64))).toMatchObject({ allowed: true });
  });

  it("expires abandoned concurrency leases without refunding daily quota", async () => {
    const { quota } = store({ concurrent: 1, leaseMilliseconds: 30, rate: 100, daily: 2 });
    await quota.acquire("b".repeat(64));
    await delay(60);
    expect(await admitAndRelease(quota)).toMatchObject({ allowed: true });
    expect(await quota.acquire("b".repeat(64))).toMatchObject({ allowed: false, code: "DailyLimitExceeded" });
  });

  it("allows another request after the short window expires", async () => {
    const { quota } = store({ rate: 1, windowSeconds: 1 });
    await admitAndRelease(quota);
    expect(await quota.acquire("b".repeat(64))).toMatchObject({ allowed: false, code: "RateLimitExceeded" });
    await delay(1_100);
    expect(await admitAndRelease(quota)).toMatchObject({ allowed: true });
  });

  it("sets daily expiry at the next UTC midnight", async () => {
    const { quota, namespace } = store();
    await admitAndRelease(quota);
    const redis = new Redis(redisUrl!, { maxRetriesPerRequest: 0 });
    try {
      const [seconds] = await redis.time();
      const expected = 86_400 - Number(seconds) % 86_400;
      const ttl = await redis.ttl(`${namespace}:{analyses}:global:daily`);
      expect(ttl).toBeGreaterThanOrEqual(expected - 2);
      expect(ttl).toBeLessThanOrEqual(expected + 2);
    } finally {
      redis.disconnect();
    }
  });
});
