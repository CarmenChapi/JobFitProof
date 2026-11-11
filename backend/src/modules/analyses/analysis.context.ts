import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import type { AnalysisReport, CreateAnalysisInput } from "./analysis.schema.js";

const lifetimeMs = 2 * 60 * 60 * 1000;
const maxTokenLength = 131_072;
const purpose = "jobfitproof:analysis-context:v1";

export class AnalysisContextError extends Error {
  constructor() { super("The original analysis context is unavailable or invalid"); }
}

function encryptionKey() {
  return Buffer.from(hkdfSync("sha256", Buffer.from(env.INTERNAL_API_SECRET, "hex"), Buffer.alloc(0), purpose, 32));
}

function associatedData(input: CreateAnalysisInput, clientId: string) {
  const fingerprint = createHash("sha256").update(JSON.stringify([
    input.cvText, input.jobText, input.seniority, input.language
  ])).digest("hex");
  return Buffer.from(`${purpose}:${clientId}:${fingerprint}`);
}

/** Keep the authenticated first report in browser memory without server-side CV storage. */
export function sealAnalysisContext(input: CreateAnalysisInput, clientId: string, report: AnalysisReport): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv, { authTagLength: 16 });
  cipher.setAAD(associatedData(input, clientId));
  const payload = JSON.stringify({ expiresAt: Date.now() + lifetimeMs, report: { ...report, reviewToken: null } });
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const token = ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
  if (token.length > maxTokenLength) throw new Error("Analysis context exceeds its size limit");
  return token;
}

export function openAnalysisContext(input: CreateAnalysisInput, clientId: string): AnalysisReport {
  try {
    const token = input.reviewToken;
    if (!token || token.length > maxTokenLength ||
      !/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/.test(token)) throw new AnalysisContextError();
    const [, iv, ciphertext, tag] = token.split(".");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv!, "base64url"), { authTagLength: 16 });
    decipher.setAAD(associatedData(input, clientId));
    decipher.setAuthTag(Buffer.from(tag!, "base64url"));
    // Do not parse or use decrypted data until GCM authentication has succeeded.
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext!, "base64url")), decipher.final()]);
    const payload = JSON.parse(plaintext.toString("utf8")) as { expiresAt: number; report: AnalysisReport };
    if (!Number.isSafeInteger(payload.expiresAt) || Date.now() >= payload.expiresAt) throw new AnalysisContextError();
    for (const answer of input.clarifications ?? []) {
      const requirement = payload.report.requirements.find((item) => item.id === answer.requirementId);
      if (!requirement || requirement.label !== answer.requirement ||
        (answer.kind !== undefined && answer.kind !== requirement.kind) ||
        (requirement.kind === "evidence" && answer.response !== "no" && !answer.details.trim())) {
        throw new AnalysisContextError();
      }
    }
    return payload.report;
  } catch {
    // Authentication, expiry and binding failures have the same public outcome.
    throw new AnalysisContextError();
  }
}
