import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createQuotaStore, sampleInput, serviceHeaders } from "./helpers.js";

const apps: ReturnType<typeof buildApp>[] = [];
const privateDetail = "synthetic-secret redis://user:password@internal-host:6379 /srv/private/service.ts";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function setup(error?: Error) {
  const quotaStore = createQuotaStore();
  const analyse = vi.fn().mockRejectedValue(error ?? new Error(privateDetail));
  const app = buildApp({ quotaStore, analyse });
  apps.push(app);
  return { app, quotaStore, analyse };
}

describe("public API errors", () => {
  it("keeps exception details in the server log and returns a generated reference", async () => {
    const error = Object.assign(new Error(privateDetail), {
      name: "PrivateConnectionError", code: "INTERNAL_CREDENTIAL_ERROR", details: { password: "synthetic-secret" },
      headers: { "x-private-debug": "synthetic-secret" }
    });
    const { app, quotaStore } = setup(error);
    const logged = vi.fn();
    let loggedRequestId = "";
    app.addHook("onRequest", async (request) => {
      loggedRequestId = request.id;
      vi.spyOn(request.log, "error").mockImplementation(logged);
    });
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: sampleInput
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "InternalServerError",
      message: "The server could not complete the request",
      requestId: loggedRequestId
    });
    expect(loggedRequestId).toMatch(uuid);
    expect(response.headers["x-request-id"]).toBe(loggedRequestId);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-private-debug"]).toBeUndefined();
    expect(logged).toHaveBeenCalledWith({ err: error }, "Request failed");
    expect(quotaStore.release).toHaveBeenCalledWith("test-reservation");
  });

  it.each([400, 401, 403, 409, 503, 700, Number.NaN])("never exposes thrown error details with status %s", async (statusCode) => {
    const { app } = setup(Object.assign(new Error(privateDetail), { statusCode, name: "PrivateErrorType" }));
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: sampleInput
    });
    expect(response.statusCode).toBe(statusCode >= 400 && statusCode <= 599 ? statusCode : 500);
    expect(response.body).not.toContain("synthetic-secret");
    expect(response.body).not.toContain("PrivateErrorType");
    expect(Object.keys(response.json()).sort()).toEqual(["error", "message", "requestId"]);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it.each([
    { contentType: "application/json", payload: `{"cvText": "${privateDetail}"`, status: 400, error: "BadRequest" },
    { contentType: "application/json", payload: "", status: 400, error: "BadRequest" },
    { contentType: "application/x-private-format", payload: privateDetail, status: 415, error: "UnsupportedMediaType" },
    { contentType: "application/json", payload: "x".repeat(512 * 1024 + 1), status: 413, error: "PayloadTooLarge" }
  ])("sanitises parser errors before quota is reserved ($status, %#)", async ({ contentType, payload, status, error }) => {
    const { app, quotaStore, analyse } = setup();
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses",
      headers: { ...serviceHeaders, "content-type": contentType }, payload
    });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ error, requestId: expect.stringMatching(uuid) });
    expect(response.body).not.toContain("synthetic-secret");
    expect(response.body).not.toContain("FST_ERR");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(quotaStore.acquire).not.toHaveBeenCalled();
    expect(analyse).not.toHaveBeenCalled();
  });

  it("does not reflect unknown routes or query parameters", async () => {
    const { app } = setup();
    const response = await app.inject({ method: "GET", url: "/private-path?token=synthetic-secret" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "NotFound", message: "The requested resource was not found", requestId: expect.stringMatching(uuid)
    });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it.each([
    { path: "synthetic-secret%ZZ", status: 400 },
    { path: "synthetic-secret".repeat(10), status: 414 }
  ])("sanitises router errors that bypass the usual error handler ($status)", async ({ path, status }) => {
    const { app } = setup();
    app.get("/lookup/:value", async () => ({ ok: true }));
    const response = await app.inject({ method: "GET", url: `/lookup/${path}` });
    expect(response.statusCode).toBe(status);
    expect(response.body).not.toContain("synthetic-secret");
    expect(response.body).not.toContain("FST_ERR");
    expect(response.headers["x-request-id"]).toMatch(uuid);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns useful validation messages without echoing unknown keys or values", async () => {
    const { app, quotaStore } = setup();
    const response = await app.inject({
      method: "POST", url: "/api/v1/analyses", headers: serviceHeaders,
      payload: { ...sampleInput, cvText: { secret: privateDetail }, language: privateDetail, [privateDetail]: true }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "ValidationError", message: "Invalid analysis input", issues: [
        { path: "cvText", message: "Use between 80 and 50,000 characters for the CV" },
        { path: "language", message: "Choose es or en" },
        { path: "", message: "Provide only the supported analysis fields" }
      ]
    });
    expect(quotaStore.acquire).not.toHaveBeenCalled();
  });

  it("ignores visitor-supplied request IDs and generates a different reference per request", async () => {
    const { app } = setup();
    const headers = { "request-id": "synthetic-secret", "x-request-id": "synthetic-secret" };
    const first = await app.inject({ method: "GET", url: "/missing", headers });
    const second = await app.inject({ method: "GET", url: "/missing", headers });
    expect(first.json().requestId).toMatch(uuid);
    expect(second.json().requestId).toMatch(uuid);
    expect(first.json().requestId).not.toBe(second.json().requestId);
  });
});
