export type ClarificationAnswer = {
  requirementId: string;
  requirement: string;
  response: "yes" | "partly" | "no";
  details: string;
};

export type AnalysisRequestInput = {
  cvText: string;
  jobText: string;
  seniority: "junior" | "mid" | "senior";
  language: "es" | "en";
  clarifications?: ClarificationAnswer[];
};

const inputFields = new Set(["cvText", "jobText", "seniority", "language", "clarifications"]);
const answerFields = new Set(["requirementId", "requirement", "response", "details"]);

export function parseAnalysisInput(value: unknown): AnalysisRequestInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  if (Object.keys(value).some((field) => !inputFields.has(field))) {
    return null;
  }

  const input = value as Record<string, unknown>;
  if (typeof input.cvText !== "string" || typeof input.jobText !== "string") {
    return null;
  }

  const cvText = input.cvText.trim();
  const jobText = input.jobText.trim();
  if (cvText.length < 80 || cvText.length > 50_000 || jobText.length < 80 || jobText.length > 50_000) {
    return null;
  }
  const seniority = input.seniority;
  if (seniority !== "junior" && seniority !== "mid" && seniority !== "senior") {
    return null;
  }
  const language = input.language === undefined ? "es" : input.language;
  if (language !== "es" && language !== "en") {
    return null;
  }

  const result: AnalysisRequestInput = { cvText, jobText, seniority, language };
  if (input.clarifications !== undefined) {
    if (!Array.isArray(input.clarifications) || input.clarifications.length > 3) return null;
    const answers: ClarificationAnswer[] = [];
    for (const value of input.clarifications) {
      if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some((key) => !answerFields.has(key))) return null;
      const answer = value as Record<string, unknown>;
      if (typeof answer.requirementId !== "string" || typeof answer.requirement !== "string" ||
        typeof answer.details !== "string" || typeof answer.response !== "string" ||
        !["yes", "partly", "no"].includes(answer.response)) return null;
      const requirementId = answer.requirementId.trim();
      const requirement = answer.requirement.trim();
      const details = answer.details.trim();
      if (!requirementId || requirementId.length > 80 || !requirement || requirement.length > 160 ||
        details.length > 1000 || (answer.response !== "no" && !details) ||
        answers.some((existing) => existing.requirementId === requirementId)) return null;
      answers.push({ requirementId, requirement, response: answer.response as ClarificationAnswer["response"], details });
    }
    result.clarifications = answers;
  }
  return result;
}
