import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

import { parseAnalysisInput } from "../analysis-input";

const maxBodyBytes = 512 * 1024;

class RequestBodyError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}

function failure(status: number, error: string, message: string) {
  return Response.json({ error, message }, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function rejectRequest(request: Request, status: number, error: string, message: string) {
  if (!request.bodyUsed) {
    void request.body?.cancel().catch(() => {});
  }
  return failure(status, error, message);
}

async function readBody(request: Request): Promise<string> {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader !== null && !/^\d+$/.test(lengthHeader)) {
    throw new RequestBodyError(400, "InvalidContentLength");
  }
  const declaredLength = lengthHeader === null ? null : Number(lengthHeader);
  if (declaredLength !== null && declaredLength > maxBodyBytes) {
    throw new RequestBodyError(413, "PayloadTooLarge");
  }
  if (request.signal.aborted) {
    throw new RequestBodyError(400, "RequestAborted");
  }
  if (!request.body) {
    if (declaredLength) {
      throw new RequestBodyError(400, "InvalidContentLength");
    }
    return "";
  }

  const reader = request.body.getReader();
  let bytes = new Uint8Array(Math.max(1024, declaredLength ?? 8192));
  let totalBytes = 0;
  let interruption: RequestBodyError | undefined;
  const cancel = (error: RequestBodyError) => {
    interruption ??= error;
    void reader.cancel().catch(() => {});
  };
  const onAbort = () => cancel(new RequestBodyError(400, "RequestAborted"));
  request.signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => cancel(new RequestBodyError(408, "RequestTimeout")), 5_000);

  try {
    while (true) {
      const chunk = await reader.read();
      if (interruption) {
        throw interruption;
      }
      if (chunk.done) {
        break;
      }
      const nextSize = totalBytes + chunk.value.byteLength;
      if (nextSize > maxBodyBytes) {
        throw new RequestBodyError(413, "PayloadTooLarge");
      }
      if (declaredLength !== null && nextSize > declaredLength) {
        throw new RequestBodyError(400, "InvalidContentLength");
      }
      if (nextSize > bytes.byteLength) {
        const expanded = new Uint8Array(Math.min(maxBodyBytes, Math.max(nextSize, bytes.byteLength * 2)));
        expanded.set(bytes.subarray(0, totalBytes));
        bytes = expanded;
      }
      bytes.set(chunk.value, totalBytes);
      totalBytes = nextSize;
    }
    if (declaredLength !== null && declaredLength !== totalBytes) {
      throw new RequestBodyError(400, "InvalidContentLength");
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, totalBytes));
  } catch (error) {
    const bodyError = interruption ?? (
      error instanceof RequestBodyError ? error : new RequestBodyError(400, "InvalidBody")
    );
    if (!interruption) {
      cancel(bodyError);
    }
    throw bodyError;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

function validateBody(body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new RequestBodyError(400, "InvalidJson");
  }
  const input = parseAnalysisInput(parsed);
  if (!input) {
    throw new RequestBodyError(400, "ValidationError");
  }
  return JSON.stringify(input);
}

function clientIdentity(request: Request, secret: string): string {
  const header = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  let address = "127.0.0.1";

  if (header) {
    address = request.headers.get(header)?.trim() ?? "";
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("A trusted client IP header must be configured");
  }

  if (!isIP(address)) {
    throw new Error("A single trusted client IP address is required");
  }

  const parsed = ipaddr.process(address);
  const network = parsed.kind() === "ipv6"
    ? `${Buffer.from(parsed.toByteArray().slice(0, 8)).toString("hex")}/64`
    : parsed.toString();

  return createHmac("sha256", secret).update(`analysis-client:${network}`).digest("hex");
}

export async function proxyAnalysis(request: Request): Promise<Response> {
  try {
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
      throw new Error("Service credentials must be configured");
    }

    const configuredOrigin = process.env.APP_ORIGIN?.trim();
    if (process.env.NODE_ENV === "production" && !configuredOrigin) {
      throw new Error("The application origin must be configured");
    }
    const origin = new URL(configuredOrigin || request.url).origin;
    if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return rejectRequest(request, 403, "ForbiddenOrigin", "This request origin is not allowed");
    }
    const contentType = request.headers.get("content-type")?.trim() ?? "";
    if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(contentType)) {
      return rejectRequest(request, 415, "UnsupportedMediaType", "Send the request as UTF-8 application/json");
    }
    const encoding = request.headers.get("content-encoding")?.trim().toLowerCase();
    if (encoding && encoding !== "identity") {
      return rejectRequest(request, 415, "UnsupportedContentEncoding", "Send an uncompressed JSON request");
    }

    const backend = new URL(process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(backend.hostname);
    if (
      (backend.protocol !== "https:" && !(backend.protocol === "http:" && loopback)) ||
      backend.username || backend.password || backend.search || backend.hash || backend.pathname !== "/"
    ) {
      throw new Error("The backend must use HTTPS or loopback HTTP");
    }

    const timeout = Number(process.env.BACKEND_TIMEOUT_MS || "40000");
    if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 180_000) {
      throw new Error("Invalid backend timeout");
    }

    const clientId = clientIdentity(request, secret);
    const body = validateBody(await readBody(request));
    const response = await fetch(`${backend.origin}/api/v1/analyses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
        "x-jobfit-client": clientId,
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeout)]),
    });

    if (response.status === 401 || response.status === 403 || response.status >= 500) {
      await response.body?.cancel();
      return failure(503, "AnalysisUnavailable", "The analysis service is temporarily unavailable");
    }

    const headers = new Headers({
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter && /^\d+$/.test(retryAfter)) {
      headers.set("retry-after", retryAfter);
    }
    return new Response(await response.text(), { status: response.status, headers });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return rejectRequest(request, error.status, error.code, "The request body could not be accepted");
    }
    return rejectRequest(request, 503, "AnalysisUnavailable", "The analysis service is temporarily unavailable");
  }
}
