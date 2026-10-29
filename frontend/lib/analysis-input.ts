export type AnalysisRequestInput = {
  cvText: string;
  jobText: string;
  seniority: "junior" | "mid" | "senior";
  language: "es" | "en";
};

const inputFields = new Set(["cvText", "jobText", "seniority", "language"]);

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

  return { cvText, jobText, seniority, language };
}
