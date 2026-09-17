import type { FastifyInstance } from "fastify";

import { createAnalysisSchema } from "./analysis.schema.js";
import { createAnalysis } from "./analysis.ai.service.js";

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  app.post("/analyses", async (request, reply) => {
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

    return reply.status(200).send(await createAnalysis(result.data));
  });
}
