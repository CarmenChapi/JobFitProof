import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { AnalysisContextError, openAnalysisContext, sealAnalysisContext } from "../src/modules/analyses/analysis.context.js";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { createAnalysis } from "../src/modules/analyses/analysis.service.js";
import { createQuotaStore, sampleInput, serviceHeaders } from "./helpers.js";

const input = { ...sampleInput, jobText: `${sampleInput.jobText} English B2 is required.` };
const client = serviceHeaders["x-jobfit-client"];
const draft = createHeuristicAnalysis(input);
const english = draft.questions.find((item) => item.requirementId === "english")!;
const answer = { requirementId: english.requirementId, requirement: english.requirement, kind: "evidence" as const,
  response: "yes" as const, details: "B2; I attend weekly client meetings." };
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { vi.useRealTimers(); await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("authenticated original analysis", () => {
  it("round-trips the whole baseline with fresh encryption and no readable source excerpts", () => {
    const reviewToken = sealAnalysisContext(input, client, draft);
    expect(reviewToken).not.toBe(sealAnalysisContext(input, client, draft));
    expect(openAnalysisContext({ ...input, reviewToken, clarifications: [answer] }, client)).toEqual(draft);
    expect(Buffer.from(reviewToken.split(".")[2]!, "base64url").toString("utf8")).not.toContain(draft.requirements[0]!.label);
  });

  it.each([1, 2, 3])("rejects a changed encrypted component %s", (part) => {
    const segments = sealAnalysisContext(input, client, draft).split(".");
    segments[part] = (segments[part]![0] === "A" ? "B" : "A") + segments[part]!.slice(1);
    expect(() => openAnalysisContext({ ...input, reviewToken: segments.join("."), clarifications: [answer] }, client)).toThrow(AnalysisContextError);
  });

  it.each([
    { cvText: `${input.cvText} Changed.` }, { jobText: `${input.jobText} Changed.` },
    { seniority: "senior" as const }, { language: "es" as const }
  ])("rejects reuse against changed input (%#)", (changed) => {
    const reviewToken = sealAnalysisContext(input, client, draft);
    expect(() => openAnalysisContext({ ...input, ...changed, reviewToken, clarifications: [answer] }, client)).toThrow(AnalysisContextError);
  });

  it("binds the baseline to the requesting client", () => {
    const reviewToken = sealAnalysisContext(input, client, draft);
    expect(() => openAnalysisContext({ ...input, reviewToken, clarifications: [answer] }, "c".repeat(64))).toThrow(AnalysisContextError);
  });

  it("expires at two hours without extending the deadline when opened", () => {
    vi.useFakeTimers();
    const start = Date.now();
    const reviewToken = sealAnalysisContext(input, client, draft);
    const submission = { ...input, reviewToken, clarifications: [answer] };
    vi.setSystemTime(start + 2 * 60 * 60 * 1000 - 1);
    expect(openAnalysisContext(submission, client)).toEqual(draft);
    vi.setSystemTime(start + 2 * 60 * 60 * 1000);
    expect(() => openAnalysisContext(submission, client)).toThrow(AnalysisContextError);
  });

  it.each([
    { requirementId: "invented" }, { requirement: "Changed criterion" },
    { kind: "condition" as const }, { kind: "condition" as const, details: "" }
  ])("rejects altered answers before reserving quota (%#)", async (changed) => {
    const quotaStore = createQuotaStore();
    const analyse = vi.fn(createAnalysis);
    const app = buildApp({ quotaStore, analyse }); apps.push(app);
    const reviewToken = sealAnalysisContext(input, client, draft);
    const response = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders,
      payload: { ...input, reviewToken, clarifications: [{ ...answer, ...changed }] } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "AnalysisContextInvalid", message: "Start a new analysis before submitting answers" });
    expect(quotaStore.acquire).not.toHaveBeenCalled();
    expect(analyse).not.toHaveBeenCalled();
  });

  it("uses the decrypted first report and rejects client-supplied weights", async () => {
    const quotaStore = createQuotaStore();
    const analyse = vi.fn(createAnalysis);
    const app = buildApp({ quotaStore, analyse }); apps.push(app);
    const first = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: input });
    const initial = first.json();
    expect(initial.reviewToken).toEqual(expect.any(String));
    const payload = { ...input, reviewToken: initial.reviewToken, clarifications: [answer] };
    const bad = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders,
      payload: { ...payload, requirements: [{ id: "english", weight: 100 }] } });
    expect(bad.statusCode).toBe(400);
    expect(quotaStore.acquire).toHaveBeenCalledTimes(1);
    const final = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload });
    expect(final.statusCode).toBe(200);
    expect(analyse.mock.calls[1]![1]).toEqual({ ...initial, reviewToken: null });
    expect(final.json().reviewToken).toBeNull();
    expect(quotaStore.acquire).toHaveBeenCalledTimes(2);
    expect(quotaStore.release).toHaveBeenCalledTimes(2);
  });

  it("cannot re-extract requirements when a direct review has no baseline", async () => {
    await expect(createAnalysis({ ...input, clarifications: [answer] })).rejects.toThrow();
  });
});
