import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { buildReport, type AssessedRequirement } from "../src/modules/analyses/analysis.report.js";
import { createQuotaStore, sampleInput, serviceHeaders } from "./helpers.js";

const input = { ...sampleInput, jobText: "We need a frontend developer with React, professional English and a strong interest in AI. Professional AI experience is preferred." };
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("clarifying missing evidence", () => {
  it("asks about English and AI interest without treating silence as a gap", () => {
    const report = createHeuristicAnalysis(input);
    expect(report.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "english", status: "unknown", evidenceSource: "unknown" }),
      expect.objectContaining({ id: "ai_interest", status: "unknown", evidenceSource: "unknown" }),
      expect.objectContaining({ id: "ai_experience", status: "unknown" })
    ]));
    expect(report.gaps).toEqual([]);
    expect(report.questions.map((question) => question.requirementId)).toEqual(expect.arrayContaining(["english", "ai_interest"]));
    expect(report.questions).toHaveLength(3);
  });

  it("keeps interest separate from professional experience", () => {
    const report = createHeuristicAnalysis({ ...input, cvText: `${input.cvText} I have an interest in AI and follow online courses.` });
    expect(report.requirements.find((item) => item.id === "ai_interest")?.status).toBe("si");
    expect(report.requirements.find((item) => item.id === "ai_experience")?.status).toBe("unknown");
  });

  it("does not infer English proficiency from an unrelated advanced skill", () => {
    const report = createHeuristicAnalysis({ ...input, cvText: `${input.cvText} Advanced TypeScript skills.` });
    expect(report.requirements.find((item) => item.id === "english")?.status).toBe("unknown");
  });

  it("does not manufacture requirements for an unrelated advert", () => {
    const report = createHeuristicAnalysis({ ...sampleInput, jobText: "We need a gardener to maintain trees and lawns, manage seasonal planting and care for flowers in our gardens." });
    expect(report.requirements).toEqual([]);
    expect(report.questions).toEqual([]);
    expect(report.gaps).toEqual([]);
    expect(report.score).toBe(0);
  });

  it("does not interpret the ordinary word next as Next.js", () => {
    const report = createHeuristicAnalysis({ ...sampleInput, jobText: "Your next role is a gardening position maintaining trees and lawns, seasonal planting and flower beds." });
    expect(report.requirements).toEqual([]);
  });

  it("leaves a combined answer unassessed instead of applying it to multiple skills", () => {
    const report = createHeuristicAnalysis({ ...input, clarifications: [{
      requirementId: "english", requirement: "React and English B2", response: "yes", details: "B2; weekly client meetings.",
    }] });
    expect(report.requirements.filter((item) => item.evidenceSource === "user")).toEqual([]);
    expect(report.unassessedClarifications).toEqual(["React and English B2"]);
  });

  it("does not use practical availability as proof of a skill", () => {
    const report = createHeuristicAnalysis({ ...input, clarifications: [{
      requirementId: "english", requirement: "Working hours overlapping with the English team", kind: "condition",
      response: "yes", details: "I can join the daily meeting.",
    }] });
    expect(report.requirements.find((item) => item.id === "english")).toMatchObject({ status: "unknown", evidenceSource: "unknown" });
    expect(report.unassessedClarifications).toHaveLength(1);
  });

  it.each(["en", "es"] as const)("supports one optional round in %s through the API", async (language) => {
    const quotaStore = createQuotaStore();
    const app = buildApp({ quotaStore }); apps.push(app);
    const first = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: { ...input, language } });
    const draft = first.json();
    const english = draft.questions.find((question: { requirementId: string }) => question.requirementId === "english");
    const interest = draft.questions.find((question: { requirementId: string }) => question.requirementId === "ai_interest");
    const final = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: {
      ...input, language, clarifications: [
        { requirementId: english.requirementId, requirement: english.requirement, response: "yes", details: "B2, weekly client meetings." },
        { requirementId: interest.requirementId, requirement: interest.requirement, response: "no", details: "" }
      ]
    } });
    const report = final.json();
    expect(final.statusCode).toBe(200);
    expect(report.questions).toEqual([]);
    expect(report.requirements.find((item: { id: string }) => item.id === "english")).toMatchObject({ status: "parcial", evidenceSource: "user" });
    expect(report.gaps).toEqual([interest.requirement]);
    expect(report.cvImprovements).toEqual([english.requirement]);
    expect(report.requirements.find((item: { id: string }) => item.id === "ai_experience")).toMatchObject({ status: "unknown", evidenceSource: "unknown" });
    expect(report.score).toBeGreaterThan(draft.score);
    expect(quotaStore.acquire).toHaveBeenCalledTimes(2);
    expect(quotaStore.release).toHaveBeenCalledTimes(2);
  });

  it("allows an empty clarification round without inventing negative answers", () => {
    const report = createHeuristicAnalysis({ ...input, clarifications: [] });
    expect(report.questions).toEqual([]);
    expect(report.gaps).toEqual([]);
    expect(report.requirements.filter((item) => item.status === "unknown")).toHaveLength(3);
  });

  it("rejects oversized answers before reserving quota", async () => {
    const quotaStore = createQuotaStore();
    const app = buildApp({ quotaStore }); apps.push(app);
    const response = await app.inject({ method: "POST", url: "/api/v1/analyses", headers: serviceHeaders, payload: {
      ...input, clarifications: [{ requirementId: "english", requirement: "English", response: "yes", details: "x".repeat(1001) }]
    } });
    expect(response.statusCode).toBe(400);
    expect(quotaStore.acquire).not.toHaveBeenCalled();
  });

  it("asks every material question and prioritises essential requirements before optional ones", () => {
    const requirements: AssessedRequirement[] = [0, 1, 2, 3, 4].map((id) => ({
      id: String(id), label: `Requirement ${id}`, category: id === 4 ? "required" : "preferred", categoryLabel: "required",
      status: "unknown", evidence: "Not mentioned", evidenceSource: "unknown", weight: id + 1
    }));
    expect(buildReport(sampleInput, "Developer", requirements, "ai").questions.map((item) => item.requirementId)).toEqual(["4", "3", "2", "1", "0"]);
  });
});
