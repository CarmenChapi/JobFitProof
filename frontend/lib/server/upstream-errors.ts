const quotaCodes = new Set([
  "RateLimitExceeded", "DailyLimitExceeded", "GlobalLimitExceeded", "AnalysisBusy"
]);

const inputErrors: Record<number, { error: string; message: string }> = {
  400: { error: "ValidationError", message: "Invalid analysis input" },
  408: { error: "RequestTimeout", message: "The request took too long" },
  413: { error: "PayloadTooLarge", message: "The request body is too large" },
  415: { error: "UnsupportedMediaType", message: "Send the request as UTF-8 application/json" }
};

export function upstreamResponseHeaders(response: Response): Headers {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  const requestId = response.headers.get("x-request-id");
  if (requestId && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) {
    headers.set("x-request-id", requestId);
  }
  return headers;
}

async function readQuotaCode(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "RateLimitExceeded";

  const bytes = new Uint8Array(4096);
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 1000);

  try {
    while (true) {
      const chunk = await reader.read();
      if (timedOut) break;
      if (chunk.done) {
        const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)));
        if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && quotaCodes.has(body.error)) {
          return body.error;
        }
        break;
      }
      if (size + chunk.value.byteLength > bytes.length) break;
      bytes.set(chunk.value, size);
      size += chunk.value.byteLength;
    }
  } catch {
    // Unreadable quota errors still receive a safe, usable 429 response.
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return "RateLimitExceeded";
}

export async function sanitiseUpstreamError(response: Response): Promise<Response> {
  const headers = upstreamResponseHeaders(response);
  if (response.status === 429) {
    const error = await readQuotaCode(response);
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter && /^\d+$/.test(retryAfter) && Number.isSafeInteger(Number(retryAfter))) {
      headers.set("retry-after", String(Number(retryAfter)));
    }
    return Response.json({ error, message: "The analysis limit has been reached" }, { status: 429, headers });
  }

  void response.body?.cancel().catch(() => {});
  const inputError = inputErrors[response.status];
  if (inputError) {
    return Response.json(inputError, { status: response.status, headers });
  }
  return Response.json({
    error: "AnalysisUnavailable", message: "The analysis service is temporarily unavailable"
  }, { status: 503, headers });
}
