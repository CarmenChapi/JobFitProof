import type { AnalysisCoverage, AnalysisReport, AnalysisRequirement, CreateAnalysisInput } from "./analysis.schema.js";
import { isPracticalCondition } from "./analysis.conditions.js";
import { locateQuote } from "./analysis.sources.js";

type AssessmentFields = "kind" | "cvAssessability" | "cvAssessmentReason" | "clarificationMaterial";
export type AssessedRequirement = Omit<AnalysisRequirement, AssessmentFields | "sources"> &
  Partial<Pick<AnalysisRequirement, AssessmentFields>> & {
    question?: string | null;
    answerId?: string;
    jobQuote?: string;
    cvQuotes?: string[];
  };

export function buildReport(
  input: CreateAnalysisInput,
  roleTitle: string,
  assessed: AssessedRequirement[],
  source: AnalysisReport["source"],
  coverage?: AnalysisCoverage
): AnalysisReport {
  const es = input.language === "es";
  const acceptedAnswers = new Set<string>();
  const normalised = assessed.slice(0, 12).map((item) => {
    const { question, answerId, jobQuote, cvQuotes, ...assessment } = item;
    // The candidate's kind hint cannot turn a skill into a practical condition.
    const kind = isPracticalCondition(item.label) ? "condition" : item.kind ?? "evidence";
    let answer = input.clarifications?.find((candidate) => candidate.requirementId === answerId);
    const requirement: AnalysisRequirement = {
      ...assessment, kind,
      cvAssessability: kind === "condition" ? "no" : item.cvAssessability ??
        (item.status === "unknown" || item.status === "parcial" ? "partially" : "yes"),
      cvAssessmentReason: kind === "condition"
        ? es ? "Esta condición necesita tu confirmación; el CV no demuestra tu disponibilidad." : "This condition needs your confirmation; the CV does not establish your availability."
        : item.cvAssessmentReason || (es ? "Falta información concreta para valorar este requisito." : "Specific information is needed to assess this requirement."),
      clarificationMaterial: item.clarificationMaterial ?? true,
      sources: { job: locateQuote(input.jobText, jobQuote), cv: [], clarification: null }
    };

    if (answer && kind === "evidence" && answer.response !== "no" && !answer.details.trim()) {
      answer = undefined;
      requirement.status = "unknown";
      requirement.evidenceSource = "unknown";
      requirement.evidence = es ? "Falta tu nivel o un ejemplo para valorar esta habilidad." : "Your level or an example is needed to assess this skill.";
    }
    if (kind === "condition" && answer) {
      requirement.status = answer.response === "yes" ? "si" : answer.response === "no" ? "no" : "parcial";
      requirement.evidenceSource = "user";
      requirement.evidence = answer.response === "partly" ? answer.details : answer.response === "yes"
        ? es ? "Has confirmado que esta condición te encaja." : "You confirmed that this condition works for you."
        : es ? "Has indicado que esta condición no te encaja." : "You indicated that this condition does not work for you.";
    }
    if (!answer && requirement.cvAssessability === "no") {
      requirement.status = "unknown";
      requirement.evidenceSource = "unknown";
      requirement.evidence = es ? "Necesita tu confirmación; no se puede determinar solo con el CV." : "Your confirmation is needed; this cannot be determined from the CV alone.";
    }
    if (!answer && requirement.cvAssessability === "partially" && requirement.status === "si") {
      requirement.status = "parcial";
    }
    if (requirement.status === "unknown" && requirement.cvAssessability === "yes") {
      requirement.cvAssessability = "partially";
      requirement.clarificationMaterial = true;
    }
    if (requirement.status === "unknown") requirement.evidenceSource = "unknown";
    if (kind === "evidence") {
      const excerpts = (cvQuotes ?? []).slice(0, 2)
        .map((quote) => locateQuote(input.cvText, quote))
        .filter((quote) => quote !== null);
      requirement.sources.cv = [...new Map(excerpts.map((quote) => [`${quote.start}-${quote.end}`, quote])).values()];
    }
    if (answer) {
      acceptedAnswers.add(answer.requirementId);
      // Answers come from the validated request, never from model-written text.
      requirement.sources.clarification = {
        requirementId: answer.requirementId, response: answer.response, details: answer.details
      };
    }
    return { requirement, question };
  });
  const requirements = normalised.map(({ requirement }) => requirement);

  return {
    generatedAt: new Date().toISOString(), language: input.language, seniority: input.seniority,
    roleTitle, source,
    ...summariseRequirements(requirements, input.language),
    requirements,
    reviewToken: null,
    coverage: coverage ?? {
      limit: 12,
      hasMoreRequirements: assessed.length > 12 ? true : source === "ai" ? false : null,
      additionalRequirements: assessed.slice(12, 15).flatMap((item) => {
        const quote = locateQuote(input.jobText, item.jobQuote);
        return quote ? [{ label: item.label, source: quote }] : [];
      })
    },
    unassessedClarifications: (input.clarifications ?? []).filter((answer) =>
      !acceptedAnswers.has(answer.requirementId)).map((answer) => answer.requirement),
    questions: input.clarifications !== undefined ? [] : normalised
      .filter(({ requirement }) => requirement.cvAssessability === "no" ||
        (requirement.cvAssessability === "partially" && requirement.status !== "no" &&
          (requirement.clarificationMaterial || requirement.category === "required")))
      .sort((a, b) => Number(b.requirement.category === "required") - Number(a.requirement.category === "required") || b.requirement.weight - a.requirement.weight)
      .map(({ requirement, question }) => ({
        requirementId: requirement.id,
        requirement: requirement.label,
        kind: requirement.kind,
        reason: requirement.cvAssessmentReason,
        question: requirement.kind === "condition"
          ? es ? "¿Te encaja esta condición?" : "Does this condition work for you?"
          : question || (input.language === "es"
          ? `¿Cumples este requisito: «${requirement.label}»? Añade tu nivel o un ejemplo concreto.`
          : `Do you meet this requirement: “${requirement.label}”? Add your level or a specific example.`)
      }))
  };
}

/** Score exactly the supplied set; both initial and follow-up reports use this calculation. */
export function summariseRequirements(requirements: AnalysisRequirement[], language: "es" | "en") {
  const evidence = requirements.filter((requirement) => requirement.kind === "evidence");
  const met = evidence.filter((requirement) => requirement.status === "si");
  const pending = evidence.filter((requirement) => requirement.status === "unknown");
  const totalWeight = evidence.reduce((total, requirement) => total + requirement.weight, 0);
  const supportedWeight = evidence.reduce((total, requirement) => total + requirement.weight * (
    requirement.status === "si" ? 1 : requirement.status === "parcial" ? 0.5 : 0
  ), 0);
  return {
    score: totalWeight ? Math.round(100 * supportedWeight / totalWeight) : 0,
    summary: language === "es"
      ? `${met.length} de ${evidence.length} requisitos de habilidades y experiencia cuentan con respaldo suficiente. ${pending.length} quedan por aclarar.`
      : `${met.length} of ${evidence.length} skills and experience requirements have sufficient support. ${pending.length} still need clarification.`,
    strengths: met.map((requirement) => requirement.label),
    gaps: evidence.filter((requirement) => requirement.status === "no").map((requirement) => requirement.label),
    cvImprovements: evidence.filter((requirement) => requirement.evidenceSource === "user" &&
      ["si", "parcial"].includes(requirement.status)).map((requirement) => requirement.label)
  };
}
