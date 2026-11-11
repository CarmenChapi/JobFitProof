import type { Report } from "./analysis-report";
import { translations } from "./i18n";

const seniorityLabels = { junior: "Junior", mid: "Mid", senior: "Senior" };

/** Export the assessment and its excerpts, without attaching the input documents. */
export function buildReportExport(report: Report) {
  const t = translations[report.language];
  const skills = report.requirements.filter((requirement) => requirement.kind === "evidence");
  const conditions = report.requirements.filter((requirement) => requirement.kind === "condition");
  const role = report.roleTitle.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const exportRequirement = (requirement: Report["requirements"][number]) => ({
    id: requirement.id,
    label: requirement.label,
    kind: requirement.kind,
    category: requirement.categoryLabel,
    status: requirement.kind === "condition" ? t.conditionStatus[requirement.status] : t.status[requirement.status],
    evidence: requirement.evidence,
    evidenceSource: requirement.evidenceSource,
    evidenceSourceLabel: t.provenance[requirement.evidenceSource],
    cvAssessability: requirement.cvAssessability,
    cvAssessmentReason: requirement.cvAssessmentReason,
    clarificationMaterial: requirement.clarificationMaterial,
    sources: requirement.sources,
    weight: requirement.weight,
  });

  return {
    filename: `jobfitproof-${role || t.report.filenameFallback}.json`,
    payload: {
      generatedAt: report.generatedAt,
      language: report.language,
      seniority: seniorityLabels[report.seniority],
      score: skills.length ? report.score : null,
      scoreExplanation: t.report.scoreHelp,
      source: report.source,
      roleTitle: report.roleTitle,
      summary: report.summary,
      strengths: report.strengths,
      gaps: report.gaps,
      cvImprovements: report.cvImprovements,
      unassessedClarifications: report.unassessedClarifications,
      coverage: report.coverage,
      requirements: skills.map(exportRequirement),
      conditions: conditions.map(exportRequirement),
    },
  };
}
