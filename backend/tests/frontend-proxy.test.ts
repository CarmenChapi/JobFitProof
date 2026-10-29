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
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function request(
  headers: Record<string, string> = {},
  body: BodyInit | null = JSON.stringify(sampleInput),
  signal?: AbortSignal
) {
  const options: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: {
      origin: "https://jobfit.example",
      "content-type": "application/json",
      "x-verified-client-ip": "203.0.113.1",
      ...headers
    },
    body,
    signal,
    duplex: "half"
  };
  return new Request("https://jobfit.example/api/analyze", options);
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

  it.each(["", "{", "{\"cvText\":"])("rejects malformed JSON (%s) before contacting the backend", async (body) => {
    const response = await POST(request({}, body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("InvalidJson");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    {},
    { ...sampleInput, cvText: "x".repeat(79) },
    { ...sampleInput, jobText: "x".repeat(50_001) },
    { ...sampleInput, cvText: " ".repeat(80) },
    { ...sampleInput, seniority: "lead" },
    { ...sampleInput, language: null },
    { ...sampleInput, userId: "forged" }
  ])("rejects invalid input %# before contacting the backend", async (input) => {
    const response = await POST(request({}, JSON.stringify(input)));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("ValidationError");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only normalised input and defaults the language to Spanish", async () => {
    const input = { cvText: `  ${sampleInput.cvText}\n`, jobText: sampleInput.jobText, seniority: "mid" };
    expect((await POST(request({}, JSON.stringify(input)))).status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ ...sampleInput, language: "es" });
  });

  it.each(["", "-1", "1.5", "0x10", "1e3", "10, 10"])("rejects malformed Content-Length (%s)", async (length) => {
    const response = await POST(request({ "content-length": length }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("InvalidContentLength");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([-1, 1])("rejects a declared length that differs from the received bytes by %i", async (difference) => {
    const body = JSON.stringify(sampleInput);
    const length = Buffer.byteLength(body) + difference;
    const response = await POST(request({ "content-length": String(length) }, body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("InvalidContentLength");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { headers: { origin: "https://untrusted.example" }, status: 403 },
    { headers: { "content-length": String(512 * 1024 + 1) }, status: 413 },
    { headers: { "content-type": "application/json; charset=utf-16" }, status: 415 },
    { headers: { "content-encoding": "gzip" }, status: 415 }
  ])("cancels unread rejected uploads (%#)", async ({ headers, status }) => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const response = await POST(request(headers, stream));
    expect(response.status).toBe(status);
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels as soon as a stream exceeds its declared length without waiting for its end", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("too many bytes"));
      },
      cancel
    });
    const response = await POST(request({ "content-length": "1" }, stream));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("InvalidContentLength");
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts streamed UTF-8 bytes rather than characters and cancels oversized uploads", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("€".repeat(180_000)));
      },
      cancel
    });
    const response = await POST(request({}, stream));
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([true, false])("accepts fragmented UTF-8 with a declared byte length: %s", async (declareLength) => {
    const input = { ...sampleInput, cvText: "á".repeat(5_000) };
    const bytes = new TextEncoder().encode(JSON.stringify(input));
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === bytes.length) {
          controller.close();
        } else {
          controller.enqueue(bytes.subarray(offset, ++offset));
        }
      }
    });
    const headers: Record<string, string> = {
      "content-type": "Application/JSON; charset=\"UTF-8\"",
      "content-encoding": "identity"
    };
    if (declareLength) headers["content-length"] = String(bytes.byteLength);
    const response = await POST(request(headers, stream));
    expect(response.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(input);
  });

  it("accepts valid JSON at the exact byte limit and removes padding before forwarding", async () => {
    const body = JSON.stringify(sampleInput).padEnd(512 * 1024, " ");
    const response = await POST(request({}, body));
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][1]!.body).toBe(JSON.stringify(sampleInput));
  });

  it("rejects invalid UTF-8 instead of silently replacing corrupt characters", async () => {
    const body = Buffer.concat([
      Buffer.from('{"cvText":"'), Buffer.from([0xff]), Buffer.from(sampleInput.cvText),
      Buffer.from(`","jobText":${JSON.stringify(sampleInput.jobText)},"seniority":"mid"}`)
    ]);
    const response = await POST(request({}, body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("InvalidBody");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops slow uploads after five seconds without waiting for cancellation to finish", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const pending = POST(request({}, stream));
    await vi.advanceTimersByTimeAsync(5_001);
    const response = await pending;
    expect(response.status).toBe(408);
    expect((await response.json()).error).toBe("RequestTimeout");
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([true, false])("cancels disconnected uploads (already aborted: %s)", async (alreadyAborted) => {
    const abort = new AbortController();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    if (alreadyAborted) abort.abort();
    const pending = POST(request({}, stream, abort.signal));
    if (!alreadyAborted) abort.abort();
    const response = await pending;
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("RequestAborted");
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides stream failure details and never forwards a partial body", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("private upload details"));
      }
    });
    const response = await POST(request({}, stream));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private upload details");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["RateLimitExceeded", "DailyLimitExceeded", "GlobalLimitExceeded", "AnalysisBusy"])("preserves %s and Retry-After without upstream details", async (error) => {
    fetchMock.mockResolvedValue(Response.json({
      error, message: "private backend details", stack: "/srv/secret.ts", credentials: "synthetic-secret", retryAfter: 999
    }, {
      status: 429, headers: { "retry-after": "1800" }
    }));
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("1800");
    expect(await response.json()).toEqual({ error, message: "The analysis limit has been reached" });
  });

  it.each([401, 403, 500, 503])("hides upstream error details (%s)", async (status) => {
    fetchMock.mockResolvedValue(new Response("private backend details", { status }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private backend details");
  });

  it.each([400, 408, 413, 415])("rebuilds upstream input errors using public messages (%s)", async (status) => {
    fetchMock.mockResolvedValue(Response.json({
      error: "PrivateInternalError", message: "private backend details", stack: "/srv/secret.ts", issues: ["synthetic-secret"]
    }, { status }));
    const response = await POST(request());
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["error", "message"]);
    expect(JSON.stringify(body)).not.toMatch(/PrivateInternalError|private backend details|secret/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([204, 302, 404, 422])("masks unexpected upstream statuses (%s)", async (status) => {
    fetchMock.mockResolvedValue(new Response(status === 204 ? null : "private backend details", { status }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "AnalysisUnavailable", message: "The analysis service is temporarily unavailable" });
  });

  it.each(["not JSON: private backend details", "null", "[]", '{"error":"PrivateInternalError"}'])("uses a safe fallback for malformed quota errors (%#)", async (body) => {
    fetchMock.mockResolvedValue(new Response(body, { status: 429 }));
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "RateLimitExceeded", message: "The analysis limit has been reached" });
  });

  it.each(["private backend details", "-1", "1e3", "999999999999999999999"])("does not forward an invalid Retry-After (%s)", async (value) => {
    fetchMock.mockResolvedValue(Response.json({ error: "RateLimitExceeded" }, { status: 429, headers: { "retry-after": value } }));
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeNull();
  });

  it("bounds quota error bodies and cancels oversized responses", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(4097))); }, cancel
    });
    fetchMock.mockResolvedValue(new Response(stream, { status: 429 }));
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("RateLimitExceeded");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("bounds the wait for a quota error body even when cancellation never settles", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    fetchMock.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ cancel }), { status: 429 }));
    const pending = POST(request());
    await vi.advanceTimersByTimeAsync(1001);
    const response = await pending;
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("RateLimitExceeded");
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("discards internal error bodies without reading them or waiting for cancellation", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    fetchMock.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ cancel }), { status: 500 }));
    expect((await POST(request())).status).toBe(503);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([200, 400, 429, 503])("preserves only a valid backend request reference (%s)", async (status) => {
    const requestId = "b2751e76-0986-4dab-a739-9615180b98aa";
    fetchMock.mockResolvedValue(Response.json({ error: "DailyLimitExceeded" }, {
      status, headers: { "x-request-id": requestId, "x-private-debug": "synthetic-secret" }
    }));
    const response = await POST(request());
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(response.headers.get("x-private-debug")).toBeNull();
  });

  it("does not forward arbitrary text as a backend request reference", async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 500, headers: { "x-request-id": "private backend details" } }));
    expect((await POST(request())).headers.get("x-request-id")).toBeNull();
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

  it("keeps a real backend failure private while preserving its diagnostic reference", async () => {
    const quotaStore = createQuotaStore();
    const analyse = vi.fn().mockRejectedValue(new Error("synthetic-secret /srv/private/service.ts"));
    const app = buildApp({ quotaStore, analyse });
    let backendRequestId: string | undefined;
    fetchMock.mockImplementation(async (_url, options) => {
      const upstream = await app.inject({
        method: "POST", url: "/api/v1/analyses",
        headers: Object.fromEntries(new Headers(options!.headers)), payload: options!.body as string
      });
      backendRequestId = String(upstream.headers["x-request-id"]);
      return new Response(upstream.body, {
        status: upstream.statusCode, headers: { "x-request-id": backendRequestId }
      });
    });
    try {
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "AnalysisUnavailable", message: "The analysis service is temporarily unavailable"
      });
      expect(response.headers.get("x-request-id")).toBe(backendRequestId);
      expect(quotaStore.release).toHaveBeenCalledWith("test-reservation");
    } finally {
      await app.close();
    }
  });
});
