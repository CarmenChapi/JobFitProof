import { describe, expect, it } from "vitest";
import { locateQuote, maxQuoteLength } from "../src/modules/analyses/analysis.sources.js";
import { buildReport, type AssessedRequirement } from "../src/modules/analyses/analysis.report.js";
import { createHeuristicAnalysis } from "../src/modules/analyses/analysis.heuristic.service.js";
import { parseAnalysisReport } from "../../frontend/lib/analysis-report";
import { sampleInput } from "./helpers.js";

describe("traceable assessment sources", () => {
  it("keeps the exact original span, including Unicode and whitespace", () => {
    const text = "Perfil 👩‍💻\nNivel de inglés: B2.\n\tReuniones semanales.";
    const quote = locateQuote(text, "Nivel de inglés: B2. Reuniones semanales.");
    expect(quote?.text).toBe("Nivel de inglés: B2.\n\tReuniones semanales.");
    expect(text.slice(quote!.start, quote!.end)).toBe(quote!.text);
  });

  it.each(["English C2", "Fluent English", "Inglés B2", "English…B2", "english B2", "", " "])(
    "does not turn an altered quote into a citation: %s", (quote) => {
      expect(locateQuote("English B2; weekly meetings.", quote)).toBeNull();
    }
  );

  it("bounds both the proposed quote and the matched original span", () => {
    expect(locateQuote("x".repeat(321), "x".repeat(321))).toBeNull();
    expect(locateQuote(`English${" ".repeat(321)}B2`, "English B2")).toBeNull();
  });

  it.each(["es", "en"] as const)("provides original job and CV excerpts in the keyword fallback (%s)", (language) => {
    const input = { ...sampleInput, language, cvText: `👩‍💻 ${sampleInput.cvText}`,
      jobText: `${sampleInput.jobText}\nEnglish B2 is required.\nWorking hours must overlap with UK/CET.` };
    const report = createHeuristicAnalysis(input);
    expect(parseAnalysisReport(report, input)).toEqual(report);
    for (const requirement of report.requirements) {
      const { job, cv } = requirement.sources;
      expect(job).not.toBeNull();
      expect(input.jobText.slice(job!.start, job!.end)).toBe(job!.text);
      expect(job!.text.length).toBeLessThanOrEqual(maxQuoteLength);
      for (const quote of cv) expect(input.cvText.slice(quote.start, quote.end)).toBe(quote.text);
    }
    expect(report.requirements.find((item) => item.id === "english")?.sources.cv).toEqual([]);
    expect(report.requirements.find((item) => item.kind === "condition")?.sources.cv).toEqual([]);
  });

  it("finds a bounded original excerpt even in a long unbroken paragraph", () => {
    const cvText = `${"Previous employment. ".repeat(80)}React development in a product team. ${"More context. ".repeat(80)}`;
    const report = createHeuristicAnalysis({ ...sampleInput, cvText });
    const quote = report.requirements.find((item) => item.id === "react")?.sources.cv[0];
    expect(quote?.text).toContain("React");
    expect(quote!.text.length).toBeLessThanOrEqual(maxQuoteLength);
    expect(cvText.slice(quote!.start, quote!.end)).toBe(quote!.text);
  });

  it("attaches the actual answer and deduplicates excerpts after whitespace matching", () => {
    const cvText = `${sampleInput.cvText}\nEnglish B2.\nWeekly meetings.`;
    const input = { ...sampleInput, cvText, clarifications: [{
      requirementId: "english", requirement: "English B2", response: "yes" as const, details: "B2; customer meetings every week.",
    }] };
    const assessed: AssessedRequirement = {
      id: "english", label: "English B2", kind: "evidence", category: "required", categoryLabel: "required",
      status: "si", evidence: "Relevant level and professional use.", evidenceSource: "user", weight: 10,
      answerId: "english", cvQuotes: ["English B2. Weekly meetings.", "English B2.\nWeekly meetings."],
    };
    const report = buildReport(input, "Developer", [assessed], "ai");
    expect(report.requirements[0]?.sources.cv).toHaveLength(1);
    expect(report.requirements[0]?.sources.clarification).toEqual({
      requirementId: "english", response: "yes", details: input.clarifications[0]!.details,
    });
  });

  it.each(["yes", "no", "partly"] as const)("records a condition answer verbatim (%s)", (response) => {
    const input = { ...sampleInput, jobText: `${sampleInput.jobText}\nWorking hours must overlap with UK/CET.`,
      clarifications: [{ requirementId: "condition-1", requirement: "Working hours must overlap with UK/CET.",
        kind: "condition" as const, response, details: response === "partly" ? "Available after 09:00." : "" }] };
    const report = createHeuristicAnalysis(input);
    expect(report.requirements.find((item) => item.kind === "condition")?.sources.clarification).toEqual({
      requirementId: "condition-1", response, details: input.clarifications[0]!.details,
    });
    expect(parseAnalysisReport(report, input)).toEqual(report);
  });
});
