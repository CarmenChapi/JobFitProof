import type { FastifyInstance } from "fastify";

export async function v1Routes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => ({
    name: "JobFit Proof API",
    version: "v1",
    status: "ready"
  }));
}
