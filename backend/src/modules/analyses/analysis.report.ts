import type { AnalysisReport, AnalysisRequirement, CreateAnalysisInput } from "./analysis.schema.js";
import { isPracticalCondition } from "./analysis.conditions.js";

export type AssessedRequirement = AnalysisRequirement & { question?: string | null; answerId?: string };

const directConfirmationPatterns = [
  /\b(?:interest(?:ed)?(?:\s+(?:strong|current|genuine))?\s+in|interes(?:\s+(?:actual|fuerte|real))?\s+(?:en|por))\b/,
  /\b(?:motivation|motivacion|enthusiasm|entusiasmo)\b/,
  /\b(?:willing(?:ness)?\s+to|disposicion\s+(?:a|para))\b/,
  /\b(?:relocat(?:e|ion)|reubicacion|trasladarse)\b/,
  /\b(?:availability\s+(?:to\s+(?:travel|start)|for\s+(?:travel|shifts|weekends))|(?:travel|shift)\s+availability|disponibilidad\s+para\s+(?:viajar|incorporarse|trabajar)|incorporacion|notice\s+period|start\s+date|fecha\s+de\s+incorporacion)\b/
];

function assessCv(input: CreateAnalysisInput, requirement: AssessedRequirement): AssessedRequirement {
  requirement = { ...requirement,
    kind: isPracticalCondition(requirement.label) ? "condition" : requirement.kind,
    clarificationMaterial: requirement.category === "required" || requirement.clarificationMaterial
  };
  const label = requirement.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Enforce common personal-intent cases even if the model mistakes a CV signal for confirmation.
  if (requirement.kind === "condition" || directConfirmationPatterns.some((pattern) => pattern.test(label))) {
    requirement = { ...requirement, cvAssessability: "no", cvAssessmentReason: input.language === "es"
      ? "Este requisito depende de tu situación, disposición o motivación actual y necesita confirmación directa."
      : "This requirement depends on your current circumstances, willingness or motivation and needs direct confirmation." };
  }
  const answer = input.clarifications?.find((answer) => answer.requirementId === requirement.answerId);
  if (answer) {
    if (requirement.kind === "condition") {
      return { ...requirement, status: answer.response === "yes" ? "si" : answer.response === "no" ? "no" : "parcial",
        evidenceSource: "user",
        evidence: answer.response === "partly"
          ? (input.language === "es" ? `Depende de lo indicado por ti: ${answer.details}` : `Depends on the context you supplied: ${answer.details}`)
          : answer.response === "yes"
            ? (input.language === "es" ? "Has confirmado que esta condición te encaja." : "You confirmed that this condition works for you.")
            : (input.language === "es" ? "Has indicado que esta condición no te encaja." : "You indicated that this condition does not work for you.")
      };
    }
    if (answer.response !== "no" && !answer.details.trim()) {
      // A client-provided condition hint must not turn an unsupported skill into evidence.
      return { ...requirement, answerId: undefined, status: "unknown", evidenceSource: "unknown",
        evidence: input.language === "es" ? "Falta un nivel o ejemplo para valorar esta habilidad." : "A level or example is needed to assess this skill." };
    }
    return requirement;
  }

  if (requirement.cvAssessability === "no") {
    return {
      ...requirement,
      status: "unknown",
      evidenceSource: "unknown",
      evidence: input.language === "es"
        ? "Este requisito necesita tu confirmación; el CV por sí solo no permite valorarlo."
        : "This requirement needs your confirmation; the CV alone cannot establish it."
    };
  }

  // Missing evidence cannot reasonably be classified as fully assessable from this CV.
  if (requirement.cvAssessability === "yes" && requirement.status === "unknown") {
    return { ...requirement, cvAssessability: "partially", cvAssessmentReason: input.language === "es"
      ? "El CV no aporta la información necesaria para completar esta valoración."
      : "The CV lacks the information needed to complete this assessment." };
  }

  if (requirement.cvAssessability === "partially" && requirement.status === "si") {
    return { ...requirement, status: "parcial" };
  }
  return requirement;
}

export function needsClarification(requirement: AssessedRequirement): boolean {
  if (requirement.answerId) return false;
  return requirement.cvAssessability === "no" ||
    (requirement.cvAssessability === "partially" && requirement.clarificationMaterial);
}

export function buildReport(
  input: CreateAnalysisInput,
  roleTitle: string,
  assessed: AssessedRequirement[],
  source: AnalysisReport["source"]
): AnalysisReport {
  assessed = assessed.map((requirement) => assessCv(input, requirement));
  const requirements = assessed.map(({ question: _question, answerId: _answerId, ...requirement }) => requirement);
  const evidenceRequirements = requirements.filter((requirement) => requirement.kind !== "condition");
  const met = evidenceRequirements.filter((requirement) => requirement.status === "si");
  const pending = evidenceRequirements.filter((requirement) => requirement.status === "unknown");
  const totalWeight = evidenceRequirements.reduce((total, requirement) => total + requirement.weight, 0);
  const supportedWeight = evidenceRequirements.reduce((total, requirement) => total + requirement.weight * (
    requirement.status === "si" ? 1 : requirement.status === "parcial" ? 0.5 : 0
  ), 0);

  return {
    generatedAt: new Date().toISOString(), language: input.language, seniority: input.seniority,
    roleTitle, source,
    score: totalWeight ? Math.round(100 * supportedWeight / totalWeight) : 0,
    summary: evidenceRequirements.length
      ? input.language === "es"
        ? `${met.length} de ${evidenceRequirements.length} requisitos de habilidades y experiencia cuentan con respaldo suficiente. ${pending.length} quedan por aclarar.`
        : `${met.length} of ${evidenceRequirements.length} skill and experience requirements have sufficient support. ${pending.length} still need clarification.`
      : input.language === "es" ? "No hay requisitos de habilidades o experiencia evaluables para calcular una puntuación." : "There are no assessable skill or experience requirements from which to calculate a score.",
    strengths: met.map((requirement) => requirement.label),
    gaps: evidenceRequirements.filter((requirement) => requirement.status === "no").map((requirement) => requirement.label),
    requirements,
    cvImprovements: evidenceRequirements.filter((requirement) => requirement.evidenceSource === "user" &&
      ["si", "parcial"].includes(requirement.status)).map((requirement) => requirement.label),
    unassessedClarifications: (input.clarifications ?? []).filter((answer) =>
      !assessed.some((requirement) => requirement.answerId === answer.requirementId)).map((answer) => answer.requirement),
    questions: input.clarifications !== undefined ? [] : assessed
      .filter(needsClarification)
      .sort((a, b) => Number(b.cvAssessability === "no") - Number(a.cvAssessability === "no") ||
        Number(b.category === "required") - Number(a.category === "required") || b.weight - a.weight)
      .map((requirement) => ({
        requirementId: requirement.id,
        requirement: requirement.label,
        kind: requirement.kind,
        reason: requirement.cvAssessmentReason,
        question: requirement.kind === "condition"
          ? (input.language === "es" ? "¿Te encaja esta condición?" : "Does this condition work for you?")
          : requirement.question || (input.language === "es"
          ? `¿Cumples este requisito: «${requirement.label}»? Añade tu nivel o un ejemplo concreto.`
          : `Do you meet this requirement: “${requirement.label}”? Add your level or a specific example.`)
      }))
  };
}
