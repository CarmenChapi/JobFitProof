import { z } from "zod";

const textField = z.string().trim().min(80).max(50_000);

export const createAnalysisSchema = z
  .object({
    cvText: textField,
    jobText: textField,
    seniority: z.enum(["junior", "mid", "senior"]),
    language: z.enum(["es", "en"]).default("es")
  })
  .strict();

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
export type AnalysisLanguage = CreateAnalysisInput["language"];
export type Seniority = CreateAnalysisInput["seniority"];

export type RequirementStatus = "si" | "parcial" | "no";
export type RequirementCategory = "required" | "preferred";

export type AnalysisRequirement = {
  id: string;
  label: string;
  category: RequirementCategory;
  categoryLabel: string;
  status: RequirementStatus;
  evidence: string;
  weight: number;
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
};
