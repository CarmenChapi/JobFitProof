import { afterEach, describe, expect, it, vi } from "vitest";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { parse }; } }));
vi.mock("../src/config/env.js", () => ({ env: { NODE_ENV: "development", OPENAI_API_KEY: "test-only", OPENAI_MODEL: "gpt-5-mini", OPENAI_TIMEOUT_MS: 1000 } }));

import { createAiAnalysis } from "../src/modules/analyses/analysis.ai.service.js";
import { createAnalysis } from "../src/modules/analyses/analysis.service.js";
import { sampleInput } from "./helpers.js";

const requirement = {
  id: "english", label: "English B2", category: "required", status: "unknown", evidence: "English is not mentioned in the CV.",
  evidenceSource: "unknown", clarificationId: null, question: "What is your English level?", weight: 10
};
const input = { ...sampleInput, jobText: `${sampleInput.jobText} English B2 is required.` };
const answer = { requirementId: "english", requirement: "English B2", response: "yes" as const, details: "C1; I lead weekly client meetings in English." };
afterEach(() => { vi.restoreAllMocks(); parse.mockReset(); });

describe("AI clarification reports", () => {
  it("asks before classifying missing English as a gap", async () => {
    parse.mockResolvedValue({ output_parsed: { roleTitle: "Developer", requirements: [requirement] } });
    const report = await createAiAnalysis(input);
    expect(report.gaps).toEqual([]);
    expect(report.questions[0]).toMatchObject({ requirementId: "english", question: "What is your English level?" });
  });

  it("passes answers separately from the CV and recalculates the score with user provenance", async () => {
    parse.mockResolvedValue({ output_parsed: { roleTitle: "Developer", requirements: [{
      ...requirement, status: "si", evidenceSource: "user", clarificationId: "english", evidence: answer.details, question: null
    }] } });
    const report = await createAiAnalysis({ ...input, clarifications: [answer] });
    const request = parse.mock.calls[0][0];
    expect(JSON.parse(request.input)).toMatchObject({ cv: input.cvText, clarifications: [answer] });
    expect(request.store).toBe(false);
    expect(report.requirements[0]).toMatchObject({ status: "si", evidenceSource: "user" });
    expect(report.score).toBe(100);
    expect(report.cvImprovements).toEqual(["English B2"]);
    expect(report.questions).toEqual([]);
  });

  it("does not turn a negative answer into a positive match", async () => {
    parse.mockResolvedValue({ output_parsed: { roleTitle: "Developer", requirements: [{
      ...requirement, status: "si", evidenceSource: "cv"
    }] } });
    const report = await createAiAnalysis({ ...input, clarifications: [{ ...answer, response: "no", details: "" }] });
    expect(report.requirements[0]).toMatchObject({ status: "no", evidenceSource: "user" });
    expect(report.gaps).toEqual(["English B2"]);
    expect(report.cvImprovements).toEqual([]);
    expect(report.score).toBe(0);
  });

  it("does not credit a fabricated answer or an unknown requirement", async () => {
    parse.mockResolvedValue({ output_parsed: { roleTitle: "Developer", requirements: [{
      ...requirement, status: "si", evidenceSource: "user", clarificationId: "nonexistent"
    }] } });
    const report = await createAiAnalysis(input);
    expect(report.requirements[0]).toMatchObject({ status: "unknown", evidenceSource: "unknown" });
    expect(report.score).toBe(0);
    expect(report.gaps).toEqual([]);
  });

  it("does not ask a second round even when the model supplies questions", async () => {
    parse.mockResolvedValue({ output_parsed: { roleTitle: "Developer", requirements: [requirement] } });
    const report = await createAiAnalysis({ ...input, clarifications: [] });
    expect(report.questions).toEqual([]);
    expect(report.requirements[0].status).toBe("unknown");
  });

  it("retains answers and provenance if AI fails during the final review", async () => {
    parse.mockRejectedValue(new Error("Unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const report = await createAnalysis({ ...input, clarifications: [{ ...answer, requirementId: "english_b2" }] });
    expect(report.source).toBe("heuristic");
    expect(report.questions).toEqual([]);
    expect(report.requirements.find((item) => item.id === "english")).toMatchObject({ status: "parcial", evidenceSource: "user" });
    expect(report.cvImprovements).toContain("Professional English");
    expect(report.unassessedClarifications).toEqual([]);
  });

  it("discloses answers that could not be matched to an assessed requirement", async () => {
    parse.mockRejectedValue(new Error("Unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const report = await createAnalysis({ ...sampleInput, jobText: `${sampleInput.jobText} Kubernetes is required.`, clarifications: [{
      requirementId: "kubernetes", requirement: "Kubernetes", response: "yes", details: "I deploy containerised applications."
    }] });
    expect(report.unassessedClarifications).toEqual(["Kubernetes"]);
    expect(report.cvImprovements).toEqual([]);
  });
});
