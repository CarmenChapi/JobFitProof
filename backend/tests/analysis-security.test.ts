import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { createQuotaStore, sampleInput, serviceHeaders } from "./helpers.js";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function setup() {
  const quotaStore = createQuotaStore();
  const analyse = vi.fn().mockResolvedValue(createHeuristicAnalysis(sampleInput));
  const app = buildApp({ quotaStore, analyse });
  apps.push(app);
  return { app, quotaStore, analyse };
}

describe("analysis access and quotas", () => {
  it.each([undefined, `Bearer ${"c".repeat(64)}`])("rejects invalid credentials before parsing the body (%s)", async (authorization) => {
    const { app, quotaStore, analyse } = setup();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/analyses",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      payload: "not valid JSON"
    });
    expect(response.statusCode).toBe(401);
    expect(quotaStore.acquire).not.toHaveBeenCalled();
    expect(analyse).not.toHaveBeenCalled();
  });

  it.each([undefined, "203.0.113.1", "x".repeat(64)])("rejects a missing or malformed identity (%s)", async (clientId) => {
    const { app, quotaStore } = setup();
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", payload: sampleInput,
      headers: { authorization: serviceHeaders.authorization, ...(clientId ? { "x-jobfit-client": clientId } : {}) }
    });
    expect(response.statusCode).toBe(400);
    expect(quotaStore.acquire).not.toHaveBeenCalled();
  });

  it("does not reserve quota for invalid input", async () => {
    const { app, quotaStore, analyse } = setup();
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders,
      payload: { ...sampleInput, cvText: "short" }
    });
    expect(response.statusCode).toBe(400);
    expect(quotaStore.acquire).not.toHaveBeenCalled();
    expect(analyse).not.toHaveBeenCalled();
  });

  it.each(["RateLimitExceeded", "DailyLimitExceeded", "GlobalLimitExceeded", "AnalysisBusy"])("blocks analysis when %s is returned", async (code) => {
    const { app, quotaStore, analyse } = setup();
    quotaStore.acquire.mockResolvedValue({ allowed: false, code, retryAfter: 120 });
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: sampleInput
    });
    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("120");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({ error: code, retryAfter: 120 });
    expect(analyse).not.toHaveBeenCalled();
    expect(quotaStore.release).not.toHaveBeenCalled();
  });

  it("fails closed when Redis is unavailable", async () => {
    const { app, quotaStore, analyse } = setup();
    quotaStore.acquire.mockRejectedValue(new Error("synthetic Redis credential detail"));
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: sampleInput
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("credential detail");
    expect(analyse).not.toHaveBeenCalled();
  });

  it("reserves before analysis and releases the concurrency slot afterwards", async () => {
    const { app, quotaStore, analyse } = setup();
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: sampleInput
    });
    expect(response.statusCode).toBe(200);
    expect(quotaStore.acquire).toHaveBeenCalledWith(serviceHeaders["x-jobfit-client"]);
    expect(quotaStore.acquire.mock.invocationCallOrder[0]).toBeLessThan(analyse.mock.invocationCallOrder[0]);
    expect(quotaStore.release).toHaveBeenCalledWith("test-reservation");
  });

  it("releases the concurrency slot when analysis throws", async () => {
    const { app, quotaStore, analyse } = setup();
    analyse.mockRejectedValue(new Error("Synthetic analysis failure"));
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: sampleInput
    });
    expect(response.statusCode).toBe(500);
    expect(quotaStore.release).toHaveBeenCalledWith("test-reservation");
    expect(quotaStore.acquire).toHaveBeenCalledTimes(1);
  });

  it("keeps the successful report when releasing a lease fails", async () => {
    const { app, quotaStore } = setup();
    quotaStore.release.mockRejectedValue(new Error("Redis unavailable"));
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: sampleInput
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().source).toBe("heuristic");
  });
});
