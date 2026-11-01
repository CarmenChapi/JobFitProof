export type RequirementStatus = "si" | "parcial" | "no" | "unknown";
export type EvidenceSource = "cv" | "user" | "unknown";
export type CvAssessability = "yes" | "partially" | "no";
export type RequirementKind = "evidence" | "condition";

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
  }[];
  source: "ai" | "heuristic";
  questions: ClarificationQuestion[];
  cvImprovements: string[];
  unassessedClarifications: string[];
};
