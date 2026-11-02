import { describe, expect, it } from "vitest";
import { buildReport, type AssessedRequirement } from "../src/modules/analyses/analysis.report.js";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { sampleInput } from "./helpers.js";

const skill: AssessedRequirement = {
  id: "excel", label: "Excel reporting", category: "required", categoryLabel: "required",
  status: "si", evidence: "Prepared monthly reports using pivot tables.", evidenceSource: "cv", weight: 10,
  kind: "evidence", cvAssessability: "yes", cvAssessmentReason: "Explicit CV evidence.", clarificationMaterial: false
};
const hours: AssessedRequirement = {
  ...skill, id: "hours", label: "Working hours that overlap with UK/CET", weight: 100,
  // Deliberately simulate an incorrect model classification and positive inference.
  kind: "evidence", cvAssessability: "yes", evidence: "Candidate is based in Spain."
};

describe("current frontend report contract", () => {
  it("does not infer availability from location or count it towards the skills score", () => {
    const report = buildReport(sampleInput, "Project Support Officer", [skill, hours], "ai");
    expect(report.score).toBe(100);
    expect(report.questions).toEqual([expect.objectContaining({
      requirementId: "hours", kind: "condition", question: "Does this condition work for you?", reason: expect.any(String)
    })]);
    expect(report.requirements[1]).toMatchObject({ kind: "condition", cvAssessability: "no", status: "unknown", evidenceSource: "unknown" });
  });

  it.each(["yes", "no", "partly"] as const)("accepts a practical condition answer: %s", (response) => {
    const report = buildReport({ ...sampleInput, clarifications: [{
      requirementId: "hours", requirement: hours.label, kind: "condition", response,
      details: response === "partly" ? "I can attend from 10:00." : ""
    }] }, "Project Support Officer", [skill, { ...hours, answerId: "hours" }], "ai");
    expect(report.score).toBe(100);
    expect(report.requirements[1]).toMatchObject({ status: response === "yes" ? "si" : response === "no" ? "no" : "parcial", evidenceSource: "user" });
    expect(report.gaps).toEqual([]);
    expect(report.cvImprovements).toEqual([]);
    expect(report.unassessedClarifications).toEqual([]);
    expect(report.questions).toEqual([]);
  });

  it("does not credit a blank skill answer disguised as a practical condition", () => {
    const report = buildReport({ ...sampleInput, clarifications: [{
      requirementId: skill.id, requirement: skill.label, kind: "condition", response: "yes", details: ""
    }] }, "Officer", [{ ...skill, answerId: skill.id, evidenceSource: "user" }], "ai");
    expect(report.requirements[0]).toMatchObject({ kind: "evidence", status: "unknown", evidenceSource: "unknown" });
    expect(report.score).toBe(0);
    expect(report.cvImprovements).toEqual([]);
    expect(report.unassessedClarifications).toEqual([skill.label]);
  });

  it.each([
    { cvAssessability: "yes", status: "si", category: "required", clarificationMaterial: true, asks: false },
    { cvAssessability: "partially", status: "parcial", category: "required", clarificationMaterial: false, asks: true },
    { cvAssessability: "partially", status: "parcial", category: "preferred", clarificationMaterial: true, asks: true },
    { cvAssessability: "partially", status: "parcial", category: "preferred", clarificationMaterial: false, asks: false },
    { cvAssessability: "no", status: "si", category: "preferred", clarificationMaterial: false, asks: true }
  ] as const)("applies the CV assessment policy: $cvAssessability / $category / $clarificationMaterial", ({ asks, ...assessment }) => {
    const report = buildReport(sampleInput, "Officer", [{ ...skill, ...assessment }], "ai");
    expect(report.questions.length).toBe(asks ? 1 : 0);
    if (assessment.cvAssessability === "no") expect(report.requirements[0].status).toBe("unknown");
  });

  it("preserves practical conditions in fallback reports and accepts simple confirmations", () => {
    const input = { ...sampleInput, jobText: `${sampleInput.jobText}\nWorking hours must overlap with UK/CET.\nOccasional travel to other offices is required.` };
    const draft = createHeuristicAnalysis(input);
    const conditions = draft.questions.filter((question) => question.kind === "condition");
    expect(conditions).toHaveLength(2);
    const report = createHeuristicAnalysis({ ...input, clarifications: conditions.map((question) => ({
      requirementId: question.requirementId, requirement: question.requirement, kind: "condition", response: "yes", details: ""
    })) });
    expect(report.requirements.filter((requirement) => requirement.kind === "condition").every((condition) => condition.status === "si")).toBe(true);
    expect(report.questions).toEqual([]);
    expect(report.score).toBe(draft.score);
    expect(report.unassessedClarifications).toEqual([]);
  });
});
