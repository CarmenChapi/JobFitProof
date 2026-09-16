import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { env } from "./config/env.js";
import { registerCors } from "./plugins/cors.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info"
    }
  });

  app.register(registerCors);
  app.register(healthRoutes);
  app.register(v1Routes, { prefix: "/api/v1" });

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
