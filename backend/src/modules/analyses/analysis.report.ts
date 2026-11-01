import type { AnalysisReport, AnalysisRequirement, CreateAnalysisInput } from "./analysis.schema.js";

export type AssessedRequirement = AnalysisRequirement & { question?: string | null; answerId?: string };

export function buildReport(
  input: CreateAnalysisInput,
  roleTitle: string,
  assessed: AssessedRequirement[],
  source: AnalysisReport["source"]
): AnalysisReport {
  const requirements = assessed.map(({ question: _question, answerId: _answerId, ...requirement }) => requirement);
  const met = requirements.filter((requirement) => requirement.status === "si");
  const pending = requirements.filter((requirement) => requirement.status === "unknown");
  const totalWeight = requirements.reduce((total, requirement) => total + requirement.weight, 0);
  const supportedWeight = requirements.reduce((total, requirement) => total + requirement.weight * (
    requirement.status === "si" ? 1 : requirement.status === "parcial" ? 0.5 : 0
  ), 0);

  return {
    generatedAt: new Date().toISOString(), language: input.language, seniority: input.seniority,
    roleTitle, source,
    score: totalWeight ? Math.round(100 * supportedWeight / totalWeight) : 0,
    summary: input.language === "es"
      ? `${met.length} de ${requirements.length} requisitos cuentan con respaldo suficiente. ${pending.length} quedan por aclarar.`
      : `${met.length} of ${requirements.length} requirements have sufficient support. ${pending.length} still need clarification.`,
    strengths: met.map((requirement) => requirement.label),
    gaps: requirements.filter((requirement) => requirement.status === "no").map((requirement) => requirement.label),
    requirements,
    cvImprovements: requirements.filter((requirement) => requirement.evidenceSource === "user" &&
      ["si", "parcial"].includes(requirement.status)).map((requirement) => requirement.label),
    unassessedClarifications: (input.clarifications ?? []).filter((answer) =>
      !assessed.some((requirement) => requirement.answerId === answer.requirementId)).map((answer) => answer.requirement),
    questions: input.clarifications !== undefined ? [] : assessed
      .filter((requirement) => requirement.status === "unknown" || requirement.status === "parcial")
      .sort((a, b) => Number(b.category === "required") - Number(a.category === "required") || b.weight - a.weight)
      .slice(0, 3)
      .map((requirement) => ({
        requirementId: requirement.id,
        requirement: requirement.label,
        question: requirement.question || (input.language === "es"
          ? `¿Cumples este requisito: «${requirement.label}»? Añade tu nivel o un ejemplo concreto.`
          : `Do you meet this requirement: “${requirement.label}”? Add your level or a specific example.`)
      }))
  };
}
