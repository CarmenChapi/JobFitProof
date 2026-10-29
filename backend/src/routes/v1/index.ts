import type { FastifyInstance } from "fastify";

import { analysisRoutes } from "../../modules/analyses/analysis.routes.js";
import type { AnalysisDependencies } from "../../modules/analyses/analysis.controller.js";

export async function v1Routes(app: FastifyInstance, options: AnalysisDependencies): Promise<void> {
  app.get("/", async () => ({
    name: "JobFit Proof API",
    version: "v1",
    status: "ready"
  }));

  app.register(analysisRoutes, { quotaStore: options.quotaStore, analyse: options.analyse });
}
