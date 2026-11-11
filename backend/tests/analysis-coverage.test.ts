import { afterEach, describe, expect, it, vi } from "vitest";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { parse }; } }));
vi.mock("../src/config/env.js", () => ({ env: { NODE_ENV: "development", OPENAI_API_KEY: "test-only", OPENAI_MODEL: "gpt-5-mini", OPENAI_TIMEOUT_MS: 1000 } }));

import { createAiAnalysis } from "../src/modules/analyses/analysis.ai.service.js";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { createAnalysis } from "../src/modules/analyses/analysis.service.js";
import { parseAnalysisReport } from "../../frontend/lib/analysis-report";
import { buildReportExport } from "../../frontend/lib/report-export";
import { sampleInput, sampleReviewToken } from "./helpers.js";

const criteria = ["React", "TypeScript", "Next.js", "REST APIs", "Automated testing", "Accessibility", "Web performance",
  "Product collaboration", "English", "Interest in AI", "Professional AI experience", "Team leadership", "Occasional travel", "Office attendance", "Start date"];
const input = { ...sampleInput, jobText: criteria.map((criterion) => `${criterion} is required.`).join("\n") };
const requirements = criteria.slice(0, 12).map((label, index) => ({
  id: `criterion-${index}`, label, category: "required", status: "unknown", evidence: "Not established by the CV.",
  evidenceSource: "unknown", clarificationId: null, question: "Can you provide an example?", weight: index + 1,
  kind: "evidence", cvAssessability: "partially", cvAssessmentReason: "Further details are needed.", clarificationMaterial: true,
  jobQuote: `${label} is required.`, cvQuotes: []
}));
const additionalRequirements = criteria.slice(12).map((label) => ({ label, jobQuote: `${label} is required.` }));
afterEach(() => { vi.restoreAllMocks(); parse.mockReset(); });

describe("advert coverage", () => {
  it.each([11, 12, 13, 15])("counts recognised criteria before applying the cap (%s criteria)", (count) => {
    const supplied = { ...sampleInput, jobText: criteria.slice(0, count).map((label) => `${label} is required.`).join("\n") };
    const report = createHeuristicAnalysis(supplied);
    expect(report.requirements).toHaveLength(Math.min(12, count));
    expect(report.coverage).toMatchObject({ limit: 12, hasMoreRequirements: count > 12 ? true : null });
    expect(report.coverage.additionalRequirements).toHaveLength(Math.max(0, count - 12));
    expect(parseAnalysisReport(report, supplied)).toEqual(report);
  });

  it("reports unknown coverage when the local fallback cannot recognise an advert's criteria", () => {
    const report = createHeuristicAnalysis({ ...sampleInput, jobText: "Applicants must have civil engineering qualifications and experience of planning public transport infrastructure." });
    expect(report.coverage.hasMoreRequirements).toBeNull();
    expect(report.requirements).toEqual([]);
  });

  it("preserves verified excluded examples across review and export without exporting the review token", async () => {
    parse.mockResolvedValueOnce({ output_parsed: { roleTitle: "Developer", requirements, additionalRequirements } });
    const original = await createAiAnalysis(input);
    expect(original.coverage.hasMoreRequirements).toBe(true);
    expect(original.coverage.additionalRequirements).toHaveLength(3);
    const report = await createAnalysis({ ...input, clarifications: [] }, original);
    expect(report.coverage).toEqual(original.coverage);
    expect(report.score).toBe(original.score);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parseAnalysisReport(report, input)).toEqual(report);
    const { payload } = buildReportExport({ ...report, reviewToken: sampleReviewToken });
    expect(payload.coverage).toEqual(original.coverage);
    expect(payload.requirements.map(({ id, weight }) => ({ id, weight }))).toEqual(requirements.map(({ id, weight }) => ({ id, weight })));
    expect(payload).not.toHaveProperty("reviewToken");
  });

  it("does not infer overflow merely because the AI assessed exactly twelve requirements", async () => {
    parse.mockResolvedValue({ output_parsed: { roleTitle: "Developer", requirements, additionalRequirements: [] } });
    const report = await createAiAnalysis(input);
    expect(report.coverage.hasMoreRequirements).toBe(false);
  });

  it.each([
    [{ label: "Invented", jobQuote: "A nonexistent criterion." }],
    [{ label: "React", jobQuote: "React is required." }],
    [additionalRequirements[0], additionalRequirements[0]]
  ].map((extra) => ({ extra })))("rejects untraceable or duplicated excluded criteria (%#)", async ({ extra }) => {
    parse.mockResolvedValue({ output_parsed: { roleTitle: "Developer", requirements, additionalRequirements: extra } });
    await expect(createAiAnalysis(input)).rejects.toThrow("Invalid additional requirement");
  });

  it("rejects a claim of more than twelve criteria when fewer than twelve were assessed", async () => {
    parse.mockResolvedValue({ output_parsed: { roleTitle: "Developer", requirements: requirements.slice(0, 11), additionalRequirements } });
    await expect(createAiAnalysis(input)).rejects.toThrow("Invalid additional requirement");
  });

  it("checks coverage quotes and consistency again at the frontend boundary", () => {
    const report = createHeuristicAnalysis(input);
    const altered = { ...report, coverage: { ...report.coverage, additionalRequirements: [{
      label: "Invented", source: { text: "Invented", start: 0, end: 8 }
    }] } };
    expect(parseAnalysisReport(altered, input)).toBeNull();
    expect(parseAnalysisReport({ ...report, requirements: report.requirements.slice(0, 11), questions: [] })).toBeNull();
    expect(parseAnalysisReport({ ...report, coverage: { ...report.coverage, hasMoreRequirements: false } })).toBeNull();
    expect(parseAnalysisReport({ ...report, reviewToken: "forged" })).toBeNull();
    expect(parseAnalysisReport({ ...report, reviewToken: `v1.${"a".repeat(16)}.${"a".repeat(131072)}.${"a".repeat(22)}` })).toBeNull();
  });
});
