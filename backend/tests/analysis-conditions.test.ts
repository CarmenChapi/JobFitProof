import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { isPracticalCondition } from "../src/modules/analyses/analysis.conditions.js";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { buildReport, type AssessedRequirement } from "../src/modules/analyses/analysis.report.js";
import { createQuotaStore, sampleInput, serviceHeaders } from "./helpers.js";

const workingHours = "Working hours that overlap with UK and Central European time; daily stand-up at 9.30am CET (8.30am UK).";
const skill: AssessedRequirement = {
  id: "react", label: "React experience", kind: "evidence", category: "required", categoryLabel: "required",
  status: "si", evidence: "Three years using React.", evidenceSource: "cv", weight: 10,
  cvAssessability: "yes", cvAssessmentReason: "Concrete project evidence.", clarificationMaterial: true
};
const condition: AssessedRequirement = { ...skill, id: "hours", label: workingHours, weight: 100, question: "Provide a level and specific evidence of availability." };
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("practical job conditions", () => {
  it.each([
    workingHours, "Willingness to travel", "Hybrid working three days a week", "Office attendance in Madrid",
    "Horario laboral de 9 a 18 horas", "Disponibilidad para viajar", "Presencialidad dos días por semana", "Incorporación en dos semanas"
  ])("recognises %s", (label) => { expect(isPracticalCondition(label)).toBe(true); });

  it.each(["English C1", "Interest in AI", "High availability systems", "Experience in travel software", "Interest rate modelling"])(
    "keeps %s as evidence", (label) => { expect(isPracticalCondition(label)).toBe(false); }
  );

  it("asks for a simple confirmation of the pictured schedule, without asking for an example", () => {
    const report = buildReport({ ...sampleInput, cvText: `${sampleInput.cvText} I live in Spain.` }, "Developer", [skill, condition], "ai");
    expect(report.requirements[1]).toMatchObject({ kind: "condition", cvAssessability: "no", status: "unknown", evidenceSource: "unknown" });
    expect(report.questions).toEqual([expect.objectContaining({ kind: "condition", question: "Does this condition work for you?" })]);
    expect(report.score).toBe(100);
    expect(report.strengths).toEqual(["React experience"]);
  });

  it.each([
    ["yes", "", "si"], ["no", "", "no"], ["partly", "I can attend three days a week.", "parcial"]
  ] as const)("records %s directly without affecting the skills score", (response, details, status) => {
    const report = buildReport({ ...sampleInput, clarifications: [{
      requirementId: "hours", requirement: workingHours, kind: "condition", response, details
    }] }, "Developer", [skill, { ...condition, answerId: "hours" }], "ai");
    expect(report.requirements[1]).toMatchObject({ kind: "condition", status, evidenceSource: "user" });
    expect(report.score).toBe(100);
    expect(report.gaps).toEqual([]);
    expect(report.strengths).toEqual(["React experience"]);
    expect(report.cvImprovements).toEqual([]);
    expect(report.unassessedClarifications).toEqual([]);
  });

  it("does not produce skill strengths when the advert only has practical conditions", () => {
    const report = buildReport({ ...sampleInput, clarifications: [{
      requirementId: "hours", requirement: workingHours, kind: "condition", response: "yes", details: ""
    }] }, "Developer", [{ ...condition, answerId: "hours" }], "ai");
    expect(report.score).toBe(0);
    expect(report.strengths).toEqual([]);
    expect(report.summary).toContain("no assessable skill");
  });

  it("does not offer a truncated condition that could hide an important qualification", () => {
    const report = createHeuristicAnalysis({ ...sampleInput,
      jobText: `Working hours overlap with UK time ${"on normal working days ".repeat(8)}except for mandatory overnight shifts every weekend.`
    });
    expect(report.questions.some((question) => question.kind === "condition")).toBe(false);
  });

  it.each(["en", "es"] as const)("supports a simple confirmation through the API and fallback in %s", async (language) => {
    const quotaStore = createQuotaStore();
    const app = buildApp({ quotaStore }); apps.push(app);
    const input = { ...sampleInput, language, jobText: `We need a frontend developer with professional experience in React. ${workingHours}` };
    const draft = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: input });
    const question = draft.json().questions.find((question: { kind: string }) => question.kind === "condition");
    expect(question).toBeDefined();
    const final = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: {
      ...input, clarifications: [{ requirementId: question.requirementId, requirement: question.requirement, kind: "condition", response: "yes", details: "" }]
    } });
    expect(final.statusCode).toBe(200);
    expect(final.json().requirements.find((item: { kind: string }) => item.kind === "condition")).toMatchObject({ status: "si", evidenceSource: "user" });
    expect(final.json().score).toBe(draft.json().score);
    expect(final.json().questions).toEqual([]);
    expect(quotaStore.acquire).toHaveBeenCalledTimes(2);
  });

  it("rejects Depends without context before reserving quota", async () => {
    const quotaStore = createQuotaStore();
    const app = buildApp({ quotaStore }); apps.push(app);
    const response = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: {
      ...sampleInput, clarifications: [{ requirementId: "hours", requirement: workingHours, kind: "condition", response: "partly", details: " " }]
    } });
    expect(response.statusCode).toBe(400);
    expect(quotaStore.acquire).not.toHaveBeenCalled();
  });
});
