import type { FastifyReply, FastifyRequest } from "fastify";

import type { AnalysisQuotaStore, QuotaDecision } from "./analysis.quota.js";
import { createAnalysisSchema } from "./analysis.schema.js";
import { createAnalysis } from "./analysis.service.js";

export type AnalysisDependencies = {
  quotaStore: AnalysisQuotaStore;
  analyse?: typeof createAnalysis;
};

export function createAnalysisController({ quotaStore, analyse = createAnalysis }: AnalysisDependencies) {
  return async function analyseRequest(request: FastifyRequest, reply: FastifyReply) {
    const result = createAnalysisSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Invalid analysis input",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    let decision: QuotaDecision;
    try {
      decision = await quotaStore.acquire(request.headers["x-jobfit-client"] as string);
    } catch {
      request.log.warn("Analysis quota store unavailable");
      return reply.status(503).send({
        error: "QuotaUnavailable",
        message: "The analysis service is temporarily unavailable"
      });
    }

    if (!decision.allowed) {
      return reply.header("retry-after", decision.retryAfter).status(429).send({
        error: decision.code,
        message: "The analysis limit has been reached",
        retryAfter: decision.retryAfter
      });
    }

    try {
      return reply.status(200).send(await analyse(result.data));
    } finally {
      try {
        await quotaStore.release(decision.reservationId);
      } catch {
        request.log.warn("Analysis reservation release failed; the lease will expire");
      }
    }
  };
}
