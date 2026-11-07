import { describe, expect, it } from "vitest";
import { parseAnalysisReport } from "../../frontend/lib/analysis-report";
import { buildReportExport } from "../../frontend/lib/report-export";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { sampleInput } from "./helpers.js";

const input = {
  ...sampleInput,
  jobText: `${sampleInput.jobText}\nEnglish B2 is required.\nWorking hours must overlap with UK/CET.`,
};

describe("report validation and export", () => {
  it.each(["en", "es"] as const)("accepts backend reports before and after clarification in %s", (language) => {
    const draft = createHeuristicAnalysis({ ...input, language });
    expect(parseAnalysisReport(draft)).toEqual(draft);
    const final = createHeuristicAnalysis({ ...input, language, clarifications: draft.questions.map((question) => ({
      requirementId: question.requirementId, requirement: question.requirement, kind: question.kind,
      response: "yes", details: question.kind === "condition" ? "" : "B2; weekly client meetings.",
    })) });
    expect(parseAnalysisReport(final)).toEqual(final);
    const { payload } = buildReportExport(final);
    expect(payload.generatedAt).toBe(final.generatedAt);
    expect(payload.language).toBe(language);
    expect(payload.requirements.every((item) => item.kind === "evidence")).toBe(true);
    expect(payload.conditions).toHaveLength(1);
    expect(payload.conditions[0]).toMatchObject({ kind: "condition", evidenceSource: "user" });
    expect(payload.conditions[0].status).toBe(language === "es" ? "Te encaja" : "Works for you");
    expect(payload).not.toHaveProperty("cvText");
    expect(payload).not.toHaveProperty("jobText");
    expect(payload.conditions[0]?.sources.clarification).toMatchObject({ response: "yes", details: "" });
    expect(payload.requirements[0]?.sources).toEqual(final.requirements[0]?.sources);
  });

  it.each([
    null, [], { source: "heuristic" },
    { ...createHeuristicAnalysis(input), score: 101 },
    { ...createHeuristicAnalysis(input), score: NaN },
    { ...createHeuristicAnalysis(input), generatedAt: "not a date" },
    { ...createHeuristicAnalysis(input), cvImprovements: null },
    { ...createHeuristicAnalysis(input), debug: "private data" },
  ])("rejects incomplete or invalid reports (%#)", (value) => {
    expect(parseAnalysisReport(value)).toBeNull();
  });

  it("rejects invalid statuses and duplicate requirement IDs before rendering", () => {
    const report = createHeuristicAnalysis(input);
    expect(parseAnalysisReport({ ...report, requirements: [{ ...report.requirements[0], status: "met" }] })).toBeNull();
    expect(parseAnalysisReport({ ...report, requirements: [...report.requirements, report.requirements[0]] })).toBeNull();
  });

  it("rejects a question attached to a different requirement", () => {
    const report = createHeuristicAnalysis(input);
    expect(parseAnalysisReport({ ...report, questions: [{ ...report.questions[0], requirementId: "missing" }] })).toBeNull();
    const kind = report.questions[0]!.kind === "condition" ? "evidence" : "condition";
    expect(parseAnalysisReport({ ...report, questions: [{ ...report.questions[0], kind }] })).toBeNull();
  });

  it("exports no percentage when only practical conditions can be assessed", () => {
    const report = createHeuristicAnalysis({ ...sampleInput, jobText: "Working hours must overlap with UK/CET." });
    const { payload, filename } = buildReportExport(report);
    expect(payload.score).toBeNull();
    expect(payload.requirements).toEqual([]);
    expect(payload.conditions).toHaveLength(1);
    expect(filename).toMatch(/^jobfitproof-[a-z0-9-]+\.json$/);
  });

  it("checks quoted text and offsets against the actual submitted documents", () => {
    const report = createHeuristicAnalysis(input);
    expect(parseAnalysisReport(report, input)).toEqual(report);
    const first = report.requirements[0]!;
    const changed = { ...report, requirements: [{ ...first, sources: {
      ...first.sources, cv: [{ text: "Invented evidence", start: 0, end: 17 }],
    } }] };
    expect(parseAnalysisReport(changed, input)).toBeNull();
    expect(parseAnalysisReport({ ...report, requirements: [{ ...first, sources: {
      ...first.sources, cv: [{ text: "React", start: -1, end: 4 }],
    } }] })).toBeNull();
  });

  it("rejects a purported answer that was never submitted", () => {
    const report = createHeuristicAnalysis(input);
    const changed = { ...report, requirements: report.requirements.map((requirement) => ({
      ...requirement, sources: { ...requirement.sources,
        clarification: { requirementId: requirement.id, response: "yes", details: "Invented answer" },
      },
    })) };
    expect(parseAnalysisReport(changed, input)).toBeNull();
  });
});
