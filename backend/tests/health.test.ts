import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

describe("health routes", () => {
  it("returns the API health status", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "jobfit-proof-api"
    });

    await app.close();
  });

  it("exposes the v1 API root", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: "JobFit Proof API",
      version: "v1",
      status: "ready"
    });

    await app.close();
  });
});
