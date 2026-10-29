import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { env } from "./config/env.js";
import type { AnalysisDependencies } from "./modules/analyses/analysis.controller.js";
import { RedisAnalysisQuotaStore } from "./modules/analyses/analysis.quota.js";
import { registerCors } from "./plugins/cors.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";

export function buildApp(options: Partial<AnalysisDependencies> = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info",
      redact: ["req.headers.authorization", "req.headers[\"x-jobfit-client\"]"]
    }
  });

  const quotaStore = options.quotaStore ?? new RedisAnalysisQuotaStore(env.REDIS_URL, {
    rate: env.ANALYSIS_RATE_LIMIT,
    windowSeconds: env.ANALYSIS_WINDOW_SECONDS,
    daily: env.ANALYSIS_DAILY_LIMIT,
    globalDaily: env.ANALYSIS_GLOBAL_DAILY_LIMIT,
    concurrent: env.ANALYSIS_MAX_CONCURRENT,
    leaseMilliseconds: env.OPENAI_TIMEOUT_MS + 60_000
  });

  app.addHook("onClose", async () => quotaStore.close());
  app.register(registerCors);
  app.register(healthRoutes);
  app.register(v1Routes, { prefix: "/api/v1", quotaStore, analyse: options.analyse });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: "Not Found",
      message: `Route ${request.method} ${request.url} was not found`
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);

    reply.status(error.statusCode ?? 500).send({
      error: error.name,
      message: error.message
    });
  });

  return app;
}
