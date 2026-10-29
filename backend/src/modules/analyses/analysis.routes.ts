import type { FastifyInstance } from "fastify";

import { authenticateAnalysis } from "./analysis.auth.js";
import { createAnalysisController, type AnalysisDependencies } from "./analysis.controller.js";

export async function analysisRoutes(app: FastifyInstance, options: AnalysisDependencies): Promise<void> {
  app.post("/analyses", {
    onRequest: authenticateAnalysis,
    bodyLimit: 512 * 1024
  }, createAnalysisController(options));
}
