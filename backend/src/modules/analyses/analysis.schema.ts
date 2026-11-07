import { z } from "zod";

const textField = z.string().trim().min(80).max(50_000);

const clarificationSchema = z.object({
  requirementId: z.string().trim().min(1).max(80),
  requirement: z.string().trim().min(1).max(160),
  kind: z.enum(["evidence", "condition"]).optional(),
  response: z.enum(["yes", "partly", "no"]),
  details: z.string().trim().max(1000)
}).strict().refine((answer) => answer.response === "no" || answer.details.length > 0 ||
  (answer.kind === "condition" && answer.response === "yes"));

export const createAnalysisSchema = z
  .object({
    cvText: textField,
    jobText: textField,
    seniority: z.enum(["junior", "mid", "senior"]),
    language: z.enum(["es", "en"]).default("es"),
    clarifications: z.array(clarificationSchema).max(12)
      .refine((answers) => new Set(answers.map((answer) => answer.requirementId)).size === answers.length)
      .optional()
  })
  .strict();

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
export type AnalysisLanguage = CreateAnalysisInput["language"];
export type Seniority = CreateAnalysisInput["seniority"];

export type RequirementStatus = "si" | "parcial" | "no" | "unknown";
export type RequirementCategory = "required" | "preferred";
export type EvidenceSource = "cv" | "user" | "unknown";
export type RequirementKind = "evidence" | "condition";
export type CvAssessability = "yes" | "partially" | "no";

export type SourceQuote = {
  text: string;
  start: number;
  end: number;
};

export type RequirementSources = {
  job: SourceQuote | null;
  cv: SourceQuote[];
  clarification: Pick<NonNullable<CreateAnalysisInput["clarifications"]>[number], "requirementId" | "response" | "details"> | null;
};

export type AnalysisRequirement = {
  id: string;
  label: string;
  kind: RequirementKind;
  category: RequirementCategory;
  categoryLabel: string;
  status: RequirementStatus;
  evidence: string;
  evidenceSource: EvidenceSource;
  weight: number;
  cvAssessability: CvAssessability;
  cvAssessmentReason: string;
  clarificationMaterial: boolean;
  sources: RequirementSources;
};

export type ClarificationQuestion = {
  requirementId: string;
  requirement: string;
  kind: RequirementKind;
  question: string;
  reason: string;
};

export type AnalysisReport = {
  generatedAt: string;
  language: AnalysisLanguage;
  seniority: Seniority;
  roleTitle: string;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  requirements: AnalysisRequirement[];
  source: "ai" | "heuristic";
  questions: ClarificationQuestion[];
  cvImprovements: string[];
  unassessedClarifications: string[];
};
