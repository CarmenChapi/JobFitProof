import type { FastifyInstance } from "fastify";

import { analysisRoutes } from "../../modules/analyses/analysis.routes.js";

export async function v1Routes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => ({
    name: "JobFit Proof API",
    version: "v1",
    status: "ready"
  }));

  app.register(analysisRoutes);
}
