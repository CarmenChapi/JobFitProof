import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../../config/env.js";

export async function authenticateAnalysis(request: FastifyRequest, reply: FastifyReply) {
  reply.header("cache-control", "no-store");
  const supplied = Buffer.from(request.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${env.INTERNAL_API_SECRET}`);

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return reply.status(401).send({
      error: "Unauthorised",
      message: "Valid service credentials are required"
    });
  }

  const clientId = request.headers["x-jobfit-client"];
  if (typeof clientId !== "string" || !/^[a-f0-9]{64}$/.test(clientId)) {
    return reply.status(400).send({
      error: "InvalidClientIdentity",
      message: "A valid client identity is required"
    });
  }
}
