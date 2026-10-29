import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../frontend/jobfit-proof/app/api/analyze/route";
import { buildApp } from "../src/app.js";
import { createQuotaStore, sampleInput, serviceHeaders } from "./helpers.js";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("INTERNAL_API_SECRET", "a".repeat(64));
  vi.stubEnv("APP_ORIGIN", "https://jobfit.example");
  vi.stubEnv("BACKEND_API_URL", "http://127.0.0.1:4000");
  vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "x-verified-client-ip");
  vi.stubEnv("BACKEND_TIMEOUT_MS", "40000");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async () => Response.json({ source: "heuristic" }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function request(headers: Record<string, string> = {}, body = JSON.stringify(sampleInput)) {
  return new Request("https://jobfit.example/api/analyze", {
    method: "POST",
    headers: {
      origin: "https://jobfit.example",
      "content-type": "application/json",
      "x-verified-client-ip": "203.0.113.1",
      ...headers
    },
    body
  });
}

function forwardedIdentity(index = 0) {
  return new Headers(fetchMock.mock.calls[index][1]?.headers).get("x-jobfit-client");
}

describe("Next.js analysis proxy", () => {
  it("adds its own credentials and replaces visitor-supplied internal headers", async () => {
    const response = await POST(request({
      authorization: "Bearer forged",
      "x-jobfit-client": "forged",
      "x-forwarded-for": "198.51.100.1"
    }));
    expect(response.status).toBe(200);
    const options = fetchMock.mock.calls[0][1]!;
    const headers = new Headers(options.headers);
    expect(headers.get("authorization")).toBe(serviceHeaders.authorization);
    expect(headers.get("x-jobfit-client")).toMatch(/^[a-f0-9]{64}$/);
    expect(headers.get("x-forwarded-for")).toBeNull();
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(await response.text()).not.toContain("a".repeat(64));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("shares IPv6 /64 quotas and normalises IPv4-mapped addresses", async () => {
    await POST(request({ "x-verified-client-ip": "2001:db8:1:2::1" }));
    await POST(request({ "x-verified-client-ip": "2001:0db8:0001:0002:ffff::2" }));
    await POST(request({ "x-verified-client-ip": "203.0.113.1" }));
    await POST(request({ "x-verified-client-ip": "::ffff:203.0.113.1" }));
    await POST(request({ "x-verified-client-ip": "203.0.113.2" }));
    expect(forwardedIdentity(0)).toBe(forwardedIdentity(1));
    expect(forwardedIdentity(2)).toBe(forwardedIdentity(3));
    expect(forwardedIdentity(2)).not.toBe(forwardedIdentity(4));
  });

  it.each(["INTERNAL_API_SECRET", "APP_ORIGIN", "TRUSTED_CLIENT_IP_HEADER"])("fails closed in production without %s", async (name) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(name, "");
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses one shared local identity when no trusted header is configured in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "");
    await POST(request({ "x-forwarded-for": "203.0.113.1" }));
    await POST(request({ "x-forwarded-for": "203.0.113.2" }));
    expect(forwardedIdentity(0)).toBe(forwardedIdentity(1));
  });

  it.each(["", "not-an-ip", "203.0.113.1, 203.0.113.2"])("rejects an invalid trusted IP (%s)", async (address) => {
    expect((await POST(request({ "x-verified-client-ip": address }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["https://untrusted.example", "null", ""])("rejects an invalid origin (%s)", async (origin) => {
    expect((await POST(request({ origin }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects cross-site browser requests", async () => {
    expect((await POST(request({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects JSON disguised as plain text", async () => {
    expect((await POST(request({ "content-type": "text/plain" }))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds body bytes even with a forged content length", async () => {
    expect((await POST(request({ "content-length": "1" }, "A".repeat(512 * 1024 + 1)))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves quota errors and Retry-After", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "DailyLimitExceeded" }, {
      status: 429, headers: { "retry-after": "1800" }
    }));
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("1800");
    expect(await response.json()).toEqual({ error: "DailyLimitExceeded" });
  });

  it.each([401, 403, 500, 503])("hides upstream error details (%s)", async (status) => {
    fetchMock.mockResolvedValue(new Response("private backend details", { status }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private backend details");
  });

  it("refuses to send the shared secret over remote HTTP", async () => {
    vi.stubEnv("BACKEND_API_URL", "http://backend.example");
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels an upstream request at its deadline", async () => {
    vi.stubEnv("BACKEND_TIMEOUT_MS", "1000");
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(new Error("Cancelled")), { once: true });
    }));
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });

  it("authenticates successfully against the real Fastify route", async () => {
    const quotaStore = createQuotaStore();
    const app = buildApp({ quotaStore });
    fetchMock.mockImplementation(async (_url, options) => {
      const headers = Object.fromEntries(new Headers(options!.headers));
      const upstream = await app.inject({
        method: "POST", url: "/api/v1/analyses", headers, payload: options!.body as string
      });
      return new Response(upstream.body, { status: upstream.statusCode });
    });
    try {
      const response = await POST(request());
      expect(response.status).toBe(200);
      expect((await response.json()).source).toBe("heuristic");
      expect(quotaStore.acquire).toHaveBeenCalledWith(forwardedIdentity());
    } finally {
      await app.close();
    }
  });
});
