import { describe, expect, it } from "vitest";
import { buildReport, type AssessedRequirement } from "../src/modules/analyses/analysis.report.js";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { sampleInput } from "./helpers.js";

const base: AssessedRequirement = {
  id: "requirement", label: "Requirement", kind: "evidence", category: "preferred", categoryLabel: "preferred",
  status: "parcial", evidence: "Some relevant information.", evidenceSource: "cv", weight: 1,
  cvAssessability: "partially", cvAssessmentReason: "The CV leaves a relevant detail unclear.", clarificationMaterial: true
};

describe("Can this requirement reasonably be determined from the CV?", () => {
  it.each(["si", "parcial", "no"] as const)("YES: evaluates %s CV evidence without a redundant question", (status) => {
    const report = buildReport(sampleInput, "Developer", [{ ...base, cvAssessability: "yes", status }], "ai");
    expect(report.questions).toEqual([]);
    expect(report.requirements[0].status).toBe(status);
    expect(report.requirements[0].evidenceSource).toBe("cv");
  });

  it.each([true, false])("PARTIALLY: asks only if material (%s)", (clarificationMaterial) => {
    const report = buildReport(sampleInput, "Developer", [{ ...base, clarificationMaterial }], "ai");
    expect(report.questions).toHaveLength(clarificationMaterial ? 1 : 0);
    expect(report.requirements[0].status).toBe("parcial");
  });

  it.each(["si", "parcial", "no", "unknown"] as const)("NO: asks the candidate and does not infer %s from CV signals", (status) => {
    const report = buildReport(sampleInput, "Developer", [{ ...base, cvAssessability: "no", status, clarificationMaterial: false }], "ai");
    expect(report.questions).toHaveLength(1);
    expect(report.requirements[0]).toMatchObject({ status: "unknown", evidenceSource: "unknown" });
    expect(report.gaps).toEqual([]);
  });

  it("does not accept missing evidence as a fully assessable CV requirement", () => {
    const report = buildReport(sampleInput, "Developer", [{ ...base, cvAssessability: "yes", status: "unknown", evidenceSource: "unknown" }], "ai");
    expect(report.requirements[0].cvAssessability).toBe("partially");
    expect(report.questions).toHaveLength(1);
  });

  it("always treats unresolved essential requirements as material", () => {
    const report = buildReport(sampleInput, "Developer", [{ ...base, category: "required", clarificationMaterial: false }], "ai");
    expect(report.requirements[0].clarificationMaterial).toBe(true);
    expect(report.questions).toHaveLength(1);
  });

  it("keeps all twelve questions, including direct confirmation after many technical uncertainties", () => {
    const requirements: AssessedRequirement[] = Array.from({ length: 12 }, (_, index) => ({
      ...base, id: `requirement-${index}`, category: "required", weight: 100 - index,
      cvAssessability: index === 11 ? "no" : "partially"
    }));
    const report = buildReport(sampleInput, "Developer", requirements, "ai");
    expect(report.questions).toHaveLength(12);
    expect(report.questions[0].requirementId).toBe("requirement-11");
    expect(new Set(report.questions.map((item) => item.requirementId)).size).toBe(12);
  });

  it("keeps skipped direct-confirmation requirements unknown in the final report", () => {
    const report = buildReport({ ...sampleInput, clarifications: [] }, "Developer", [{ ...base, cvAssessability: "no", status: "si" }], "ai");
    expect(report.questions).toEqual([]);
    expect(report.requirements[0].status).toBe("unknown");
    expect(report.gaps).toEqual([]);
  });

  it.each([
    "Interés actual en inteligencia artificial", "Interest in AI", "Motivation for this role",
    "Disponibilidad para viajar dos días al mes", "Willingness to travel", "Disposición a trasladarse a Madrid",
    "Incorporación en dos semanas", "Start date", "Availability to start", "Relocation"
  ])("requires confirmation of %s even when the model says the CV establishes it", (label) => {
    const report = buildReport(sampleInput, "Developer", [{ ...base, label, cvAssessability: "yes", status: "si" }], "ai");
    expect(report.requirements[0]).toMatchObject({ cvAssessability: "no", status: "unknown", evidenceSource: "unknown" });
    expect(report.questions).toHaveLength(1);
    expect(report.score).toBe(0);
  });

  it.each(["High availability systems", "Experience in travel software", "Interest rate modelling"])("does not mistake %s for personal intent", (label) => {
    const report = buildReport(sampleInput, "Developer", [{ ...base, label, cvAssessability: "yes", status: "si" }], "ai");
    expect(report.requirements[0]).toMatchObject({ cvAssessability: "yes", status: "si" });
    expect(report.questions).toEqual([]);
  });

  it("accepts an explicit answer about current interest without crediting a CV project alone", () => {
    const report = buildReport({ ...sampleInput, clarifications: [{
      requirementId: "requirement", requirement: "Interest in AI", response: "yes", details: "I am currently exploring language models in a personal project."
    }] }, "Developer", [{ ...base, label: "Interest in AI", cvAssessability: "yes", status: "si", evidenceSource: "user", answerId: "requirement" }], "ai");
    expect(report.requirements[0]).toMatchObject({ cvAssessability: "no", status: "si", evidenceSource: "user" });
    expect(report.questions).toEqual([]);
  });

  it("retains more than three questions in the basic review too", () => {
    const report = createHeuristicAnalysis({ ...sampleInput,
      cvText: "I have worked as an administrator, preparing invoices, arranging appointments and coordinating schedules for a small local business.",
      jobText: "We need React, TypeScript, Next.js, API integration, testing, accessibility, English and an interest in AI."
    });
    expect(report.questions.length).toBeGreaterThan(3);
    expect(report.questions.find((item) => item.requirementId === "ai_interest")).toBeDefined();
    expect(report.requirements.every((item) => ["yes", "partially", "no"].includes(item.cvAssessability))).toBe(true);
  });
});
