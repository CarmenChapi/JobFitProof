import { afterEach, describe, expect, it, vi } from "vitest";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { parse }; } }));
vi.mock("../src/config/env.js", () => ({ env: { NODE_ENV: "development", OPENAI_API_KEY: "test-only", OPENAI_MODEL: "gpt-5-mini", OPENAI_TIMEOUT_MS: 1000 } }));

import { buildReport, type AssessedRequirement } from "../src/modules/analyses/analysis.report.js";
import { createAnalysis } from "../src/modules/analyses/analysis.service.js";
import { parseAnalysisReport } from "../../frontend/lib/analysis-report";
import { sampleInput } from "./helpers.js";

const input = { ...sampleInput, cvText: `${sampleInput.cvText} I prepare monthly Excel reports.`,
  jobText: "Excel reporting is required. English C1 is required. Working hours must overlap with UK/CET." };
const excel: AssessedRequirement = {
  id: "excel", label: "Excel reporting", kind: "evidence", category: "required", categoryLabel: "required",
  status: "si", evidence: "The CV describes monthly reports.", evidenceSource: "cv", weight: 20,
  cvAssessability: "yes", cvAssessmentReason: "Explicit CV evidence.", clarificationMaterial: false,
  jobQuote: "Excel reporting is required.", cvQuotes: ["I prepare monthly Excel reports."]
};
const baseline = buildReport(input, "Project Support Officer", [excel, {
  ...excel, id: "english", label: "English C1", status: "unknown", evidenceSource: "unknown", evidence: "The level is not stated.",
  weight: 80, cvAssessability: "partially", clarificationMaterial: true,
  jobQuote: "English C1 is required.", cvQuotes: []
}, {
  ...excel, id: "hours", label: "Working hours must overlap with UK/CET.", kind: "condition", weight: 100,
  jobQuote: "Working hours must overlap with UK/CET.", cvQuotes: []
}], "ai");
const answer = { requirementId: "english", requirement: "English C1", kind: "evidence" as const,
  response: "yes" as const, details: "C1; I present weekly reports in English." };
const fixed = (report: typeof baseline) => report.requirements.map(({ id, label, kind, category, categoryLabel, weight, sources }) =>
  ({ id, label, kind, category, categoryLabel, weight, job: sources.job, cv: sources.cv }));
afterEach(() => { vi.restoreAllMocks(); parse.mockReset(); });

describe("reviewing a fixed set of requirements", () => {
  it.each(["en", "es"] as const)("changes only the answered assessment and uses the original weights in %s", async (language) => {
    parse.mockResolvedValue({ output_parsed: { assessments: [{ requirementId: "english", status: "si", evidence: "The candidate reports C1 and weekly presentations." }] } });
    const original = { ...baseline, language };
    const unchanged = structuredClone(original);
    const submitted = { ...input, language, clarifications: [answer] };
    const final = await createAnalysis(submitted, original);
    expect(fixed(final)).toEqual(fixed(original));
    expect(original).toEqual(unchanged);
    expect(final.requirements[0]).toEqual(original.requirements[0]);
    expect(final.requirements[2]).toEqual(original.requirements[2]);
    expect(final.coverage).toEqual(original.coverage);
    expect(final.roleTitle).toBe(original.roleTitle);
    expect(original.score).toBe(20);
    expect(final.score).toBe(100);
    expect(final.questions).toEqual([]);
    expect(final.requirements[1]!.sources.clarification).toEqual({ requirementId: answer.requirementId, response: answer.response, details: answer.details });
    expect(parseAnalysisReport(final, submitted)).toEqual(final);
    const request = parse.mock.calls[0]![0];
    expect(request.store).toBe(false);
    const sent = JSON.parse(request.input);
    expect(sent.requirements).toHaveLength(1);
    expect(sent.requirements[0]).toMatchObject({ requirementId: "english", label: "English C1", answer: { details: answer.details } });
    expect(sent).not.toHaveProperty("cv");
    expect(request.text.format.schema.properties.assessments.items.properties).not.toHaveProperty("weight");
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it.each([
    { response: "yes" as const, modelStatus: "parcial", expected: 60 },
    { response: "partly" as const, modelStatus: "si", expected: 60 },
    { response: "yes" as const, modelStatus: "no", expected: 20 },
    { response: "yes" as const, modelStatus: "unknown", expected: 20 }
  ])("does not equate yes with meeting the requested level (%#)", async ({ response, modelStatus, expected }) => {
    parse.mockResolvedValue({ output_parsed: { assessments: [{ requirementId: "english", status: modelStatus, evidence: "Assessed against the original C1 criterion." }] } });
    const report = await createAnalysis({ ...input, clarifications: [{ ...answer, response, details: "I am still learning; A1." }] }, baseline);
    expect(report.score).toBe(expected);
    expect(fixed(report)).toEqual(fixed(baseline));
  });

  it("matches provider answers by ID while retaining the original order", async () => {
    parse.mockResolvedValue({ output_parsed: { assessments: [
      { requirementId: "english", status: "si", evidence: "C1 confirmed." },
      { requirementId: "excel", status: "parcial", evidence: "Additional details suggest limited experience." }
    ] } });
    const report = await createAnalysis({ ...input, clarifications: [answer,
      { ...answer, requirementId: "excel", requirement: excel.label, response: "partly", details: "I only completed one report independently." }
    ] }, baseline);
    expect(report.requirements.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "excel", status: "parcial" }, { id: "english", status: "si" }, { id: "hours", status: "unknown" }
    ]);
    expect(report.score).toBe(90);
    expect(fixed(report)).toEqual(fixed(baseline));
  });

  it.each([
    [], [{ requirementId: "invented", status: "si", evidence: "Invented." }],
    [{ requirementId: "english", status: "si", evidence: "Modified.", weight: 1 }],
    [0, 1].map(() => ({ requirementId: "english", status: "si", evidence: "Duplicated." }))
  ].map((assessments) => ({ assessments })))("keeps the baseline on invalid review output (%#)", async ({ assessments }) => {
    parse.mockResolvedValue({ output_parsed: { assessments } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const report = await createAnalysis({ ...input, clarifications: [answer] }, baseline);
    expect(report.source).toBe("heuristic");
    expect(report.score).toBe(60);
    expect(fixed(report)).toEqual(fixed(baseline));
    expect(report.requirements[0]).toEqual(baseline.requirements[0]);
    expect(report.requirements[2]).toEqual(baseline.requirements[2]);
    expect(report.unassessedClarifications).toEqual([]);
  });

  it("does not call the provider for conditions, negative answers or a skipped round", async () => {
    const empty = await createAnalysis({ ...input, clarifications: [] }, baseline);
    expect(empty.requirements).toEqual(baseline.requirements);
    expect(empty.score).toBe(20);
    const condition = { requirementId: "hours", requirement: baseline.requirements[2]!.label, kind: "condition" as const, response: "yes" as const, details: "" };
    const report = await createAnalysis({ ...input, clarifications: [{ ...answer, response: "no", details: "" }, condition] }, baseline);
    expect(report.requirements[1]!.status).toBe("no");
    expect(report.requirements[2]!.status).toBe("si");
    expect(report.score).toBe(20);
    expect(report.gaps).toEqual(["English C1"]);
    expect(parse).not.toHaveBeenCalled();
  });
});
