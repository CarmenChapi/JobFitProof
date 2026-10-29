import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

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

async function readBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    throw new RequestBodyError(400, "InvalidContentLength");
  }
  if (declaredLength > maxBodyBytes) {
    throw new RequestBodyError(413, "PayloadTooLarge");
  }
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 5_000);

  try {
    while (true) {
      const chunk = await reader.read();
      if (timedOut) {
        throw new RequestBodyError(408, "RequestTimeout");
      }
      if (chunk.done) {
        break;
      }
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxBodyBytes) {
        void reader.cancel().catch(() => {});
        throw new RequestBodyError(413, "PayloadTooLarge");
      }
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
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
      return failure(403, "ForbiddenOrigin", "This request origin is not allowed");
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return failure(415, "UnsupportedMediaType", "Send the request as application/json");
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
    const body = await readBody(request);
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
      return failure(error.status, error.code, "The request body could not be accepted");
    }
    return failure(503, "AnalysisUnavailable", "The analysis service is temporarily unavailable");
  }
}
