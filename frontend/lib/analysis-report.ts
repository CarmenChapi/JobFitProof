export type RequirementStatus = "si" | "parcial" | "no" | "unknown";
export type EvidenceSource = "cv" | "user" | "unknown";

export type ClarificationQuestion = {
  requirementId: string;
  requirement: string;
  question: string;
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
    category: "required" | "preferred";
    categoryLabel: string;
    status: RequirementStatus;
    evidence: string;
    evidenceSource: EvidenceSource;
    weight: number;
  }[];
  source: "ai" | "heuristic";
  questions: ClarificationQuestion[];
  cvImprovements: string[];
  unassessedClarifications: string[];
};
