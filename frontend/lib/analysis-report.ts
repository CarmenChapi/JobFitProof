import type { AnalysisRequestInput } from "./analysis-input";

export type RequirementStatus = "si" | "parcial" | "no" | "unknown";
export type EvidenceSource = "cv" | "user" | "unknown";
export type CvAssessability = "yes" | "partially" | "no";
export type RequirementKind = "evidence" | "condition";

export type SourceQuote = { text: string; start: number; end: number };
export type RequirementSources = {
  job: SourceQuote | null;
  cv: SourceQuote[];
  clarification: { requirementId: string; response: "yes" | "partly" | "no"; details: string } | null;
};

export type ClarificationQuestion = {
  requirementId: string;
  requirement: string;
  kind: RequirementKind;
  question: string;
  reason: string;
};

export type Report = {
  generatedAt: string;
  language: "es" | "en";
  seniority: "junior" | "mid" | "senior";
  roleTitle: string;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  requirements: {
    id: string;
    label: string;
    kind: RequirementKind;
    category: "required" | "preferred";
    categoryLabel: string;
    status: RequirementStatus;
    evidence: string;
    evidenceSource: EvidenceSource;
    cvAssessability: CvAssessability;
    cvAssessmentReason: string;
    clarificationMaterial: boolean;
    weight: number;
    sources: RequirementSources;
  }[];
  source: "ai" | "heuristic";
  questions: ClarificationQuestion[];
  cvImprovements: string[];
  unassessedClarifications: string[];
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: RecordValue, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function isOneOf<const T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function isLabelList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 12 && value.every((item) => isText(item, 160));
}

function isQuote(value: unknown): value is SourceQuote {
  return isRecord(value) && hasOnlyKeys(value, ["text", "start", "end"]) && isText(value.text, 320) &&
    typeof value.start === "number" && Number.isInteger(value.start) && value.start >= 0 &&
    typeof value.end === "number" && Number.isInteger(value.end) && value.end <= 50_000 &&
    value.end - value.start === value.text.length;
}

function isSources(value: unknown): value is RequirementSources {
  if (!isRecord(value) || !hasOnlyKeys(value, ["job", "cv", "clarification"]) ||
    !(value.job === null || isQuote(value.job)) ||
    !Array.isArray(value.cv) || value.cv.length > 2 || !value.cv.every(isQuote)
  ) return false;
  const answer = value.clarification;
  return answer === null || (isRecord(answer) && hasOnlyKeys(answer, ["requirementId", "response", "details"]) &&
    isText(answer.requirementId, 80) && isOneOf(answer.response, ["yes", "partly", "no"]) &&
    typeof answer.details === "string" && answer.details.length <= 1000);
}

function sourcesMatchInput(sources: RequirementSources, input: AnalysisRequestInput): boolean {
  const matches = (quote: SourceQuote, text: string) => text.slice(quote.start, quote.end) === quote.text;
  if (sources.job && !matches(sources.job, input.jobText)) return false;
  if (!sources.cv.every((quote) => matches(quote, input.cvText))) return false;
  const answer = sources.clarification;
  return !answer || !!input.clarifications?.some((submitted) => submitted.requirementId === answer.requirementId &&
    submitted.response === answer.response && submitted.details === answer.details);
}

function isRequirement(value: unknown): value is Report["requirements"][number] {
  return isRecord(value) && hasOnlyKeys(value, [
    "id", "label", "kind", "category", "categoryLabel", "status", "evidence",
    "evidenceSource", "cvAssessability", "cvAssessmentReason", "clarificationMaterial", "weight", "sources",
  ]) &&
    isText(value.id, 80) && isText(value.label, 160) &&
    isOneOf(value.kind, ["evidence", "condition"]) &&
    isOneOf(value.category, ["required", "preferred"]) && isText(value.categoryLabel, 80) &&
    isOneOf(value.status, ["si", "parcial", "no", "unknown"]) && isText(value.evidence, 2000) &&
    isOneOf(value.evidenceSource, ["cv", "user", "unknown"]) &&
    isOneOf(value.cvAssessability, ["yes", "partially", "no"]) &&
    isText(value.cvAssessmentReason, 1000) && typeof value.clarificationMaterial === "boolean" && isSources(value.sources) &&
    typeof value.weight === "number" && Number.isInteger(value.weight) && value.weight >= 1 && value.weight <= 100;
}

function isQuestion(value: unknown): value is ClarificationQuestion {
  return isRecord(value) && hasOnlyKeys(value, ["requirementId", "requirement", "kind", "question", "reason"]) &&
    isText(value.requirementId, 80) && isText(value.requirement, 160) &&
    isOneOf(value.kind, ["evidence", "condition"]) &&
    isText(value.question, 500) && isText(value.reason, 1000);
}

/** Validate the public contract before forwarding or rendering a report. */
export function parseAnalysisReport(value: unknown, input?: AnalysisRequestInput): Report | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "generatedAt", "language", "seniority", "roleTitle", "score", "summary", "strengths", "gaps",
    "requirements", "source", "questions", "cvImprovements", "unassessedClarifications",
  ])) return null;

  if (
    !isText(value.generatedAt, 40) || !Number.isFinite(Date.parse(value.generatedAt)) ||
    !isOneOf(value.language, ["es", "en"]) || !isOneOf(value.seniority, ["junior", "mid", "senior"]) ||
    !isText(value.roleTitle, 120) || !isText(value.summary, 1000) ||
    typeof value.score !== "number" || !Number.isInteger(value.score) || value.score < 0 || value.score > 100 ||
    !isOneOf(value.source, ["ai", "heuristic"]) ||
    !isLabelList(value.strengths) || !isLabelList(value.gaps) ||
    !isLabelList(value.cvImprovements) || !isLabelList(value.unassessedClarifications) ||
    !Array.isArray(value.requirements) || value.requirements.length > 12 || !value.requirements.every(isRequirement) ||
    !Array.isArray(value.questions) || value.questions.length > 12 || !value.questions.every(isQuestion)
  ) return null;

  const requirements = new Map(value.requirements.map((requirement) => [requirement.id, requirement]));
  if (requirements.size !== value.requirements.length ||
    new Set(value.questions.map((question) => question.requirementId)).size !== value.questions.length
  ) return null;

  // A question must identify exactly the requirement shown in the report.
  if (!value.questions.every((question) => {
    const requirement = requirements.get(question.requirementId);
    return requirement?.label === question.requirement && requirement.kind === question.kind;
  })) return null;

  if (input && !value.requirements.every((requirement) => sourcesMatchInput(requirement.sources, input))) return null;

  return value as Report;
}
