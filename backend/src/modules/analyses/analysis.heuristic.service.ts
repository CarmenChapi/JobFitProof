import type {
  AnalysisLanguage,
  AnalysisReport,
  CreateAnalysisInput,
  RequirementCategory,
  RequirementStatus
} from "./analysis.schema.js";
import { buildReport, type AssessedRequirement } from "./analysis.report.js";
import { isPracticalCondition } from "./analysis.conditions.js";

type RequirementId =
  | "react"
  | "typescript"
  | "next"
  | "api"
  | "testing"
  | "accessibility"
  | "performance"
  | "product"
  | "english"
  | "ai_interest"
  | "ai_experience"
  | "leadership";

type RequirementDefinition = {
  id: RequirementId;
  category: RequirementCategory;
  patterns: string[];
  relatedPatterns?: string[];
  weight: number;
};

type AnalysisCopy = {
  roleFallback: string;
  summaries: {
    high: string;
    mid: string;
    low: string;
  };
  categories: Record<RequirementCategory, string>;
  requirements: Record<RequirementId, string>;
  evidence: Record<RequirementStatus, (label: string) => string>;
};

const requirementBank: RequirementDefinition[] = [
  { id: "react", category: "required", patterns: ["react"], weight: 18 },
  {
    id: "typescript",
    category: "required",
    patterns: ["typescript", "type script"],
    weight: 17
  },
  {
    id: "next",
    category: "preferred",
    patterns: ["next.js", "nextjs", "next "],
    relatedPatterns: ["server side", "ssr", "app router"],
    weight: 12
  },
  {
    id: "api",
    category: "required",
    patterns: ["api", "apis", "rest", "graphql"],
    weight: 11
  },
  {
    id: "testing",
    category: "preferred",
    patterns: ["testing", "test", "tests", "jest", "cypress", "playwright", "vitest"],
    weight: 10
  },
  {
    id: "accessibility",
    category: "preferred",
    patterns: ["accesibilidad", "accessibility", "a11y", "wcag"],
    weight: 8
  },
  {
    id: "performance",
    category: "preferred",
    patterns: ["performance", "rendimiento", "core web vitals", "lighthouse"],
    weight: 8
  },
  {
    id: "product",
    category: "preferred",
    patterns: ["producto", "product", "stakeholder", "diseno", "diseño", "design"],
    weight: 7
  },
  {
    id: "english",
    category: "preferred",
    patterns: ["ingles", "inglés", "english"],
    weight: 5
  },
  { id: "ai_interest", category: "preferred", patterns: ["interest in ai", "interested in ai", "interest in artificial intelligence", "interes en ia", "interes por la ia", "interes en inteligencia artificial", "interes por la inteligencia artificial"], weight: 5 },
  { id: "ai_experience", category: "required", patterns: ["professional ai experience", "professional experience in ai", "experience with ai", "experience in artificial intelligence", "experiencia con ia", "experiencia en ia", "experiencia en inteligencia artificial"], weight: 12 },
  {
    id: "leadership",
    category: "preferred",
    patterns: [
      "lider",
      "líder",
      "liderazgo",
      "lead",
      "leadership",
      "mentoring",
      "mentor",
      "guiando",
      "guided"
    ],
    weight: 4
  }
];

const copyByLanguage: Record<AnalysisLanguage, AnalysisCopy> = {
  es: {
    roleFallback: "Rol objetivo",
    summaries: {
      high: "Buen encaje inicial. El CV ya muestra varias pruebas fuertes para esta oferta.",
      mid: "Adecuación prometedora, con aspectos que se pueden mejorar antes de presentar la candidatura.",
      low: "Conviene reforzar las evidencias clave antes de presentar la candidatura a este puesto."
    },
    categories: {
      required: "imprescindible",
      preferred: "valorable"
    },
    requirements: {
      react: "React en producto",
      typescript: "TypeScript en producción",
      next: "Next.js / SSR",
      api: "Integración con APIs",
      testing: "Pruebas de frontend",
      accessibility: "Accesibilidad",
      performance: "Rendimiento web",
      product: "Trabajo con producto",
      english: "Inglés profesional",
      ai_interest: "Interés en inteligencia artificial",
      ai_experience: "Experiencia profesional en inteligencia artificial",
      leadership: "Liderazgo técnico"
    },
    evidence: {
      si: (label) => `Hay evidencia directa de ${label.toLowerCase()} en el CV.`,
      parcial: (label) =>
        `Aparecen señales relacionadas, pero conviene explicitar ${label.toLowerCase()} con impacto medible.`,
      no: (label) => `Has indicado que todavía no cumples el requisito de ${label.toLowerCase()}.`,
      unknown: (label) => `El CV no aporta información suficiente sobre ${label.toLowerCase()}. No se considera una carencia confirmada.`
    }
  },
  en: {
    roleFallback: "Target role",
    summaries: {
      high: "Strong initial fit. The CV already provides several clear examples of relevant experience for this role.",
      mid: "Promising fit, with gaps that can be improved before applying.",
      low: "It is worth strengthening key evidence before applying to this role."
    },
    categories: {
      required: "required",
      preferred: "preferred"
    },
    requirements: {
      react: "React in product work",
      typescript: "Production TypeScript",
      next: "Next.js / SSR",
      api: "API integration",
      testing: "Frontend testing",
      accessibility: "Accessibility",
      performance: "Web performance",
      product: "Product collaboration",
      english: "Professional English",
      ai_interest: "Interest in artificial intelligence",
      ai_experience: "Professional AI experience",
      leadership: "Technical leadership"
    },
    evidence: {
      si: (label) => `There is direct evidence of ${label.toLowerCase()} in the CV.`,
      parcial: (label) =>
        `Related signals appear, but ${label.toLowerCase()} should be stated with measurable impact.`,
      no: (label) => `You confirmed that you do not yet meet the requirement for ${label.toLowerCase()}.`,
      unknown: (label) => `The CV does not provide enough information about ${label.toLowerCase()}. This is not a confirmed gap.`
    }
  }
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAnyPattern(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => new RegExp(`(?:^|[^a-z0-9])${normalizeText(pattern).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`).test(text));
}

function inferRoleTitle(jobText: string, copy: AnalysisCopy): string {
  const normalizedJob = normalizeText(jobText);

  if (normalizedJob.includes("frontend")) {
    return "Frontend Developer";
  }

  if (normalizedJob.includes("full stack") || normalizedJob.includes("fullstack")) {
    return "Full Stack Developer";
  }

  if (normalizedJob.includes("react")) {
    return "React Developer";
  }

  return copy.roleFallback;
}

export function createHeuristicAnalysis(input: CreateAnalysisInput): AnalysisReport {
  const copy = copyByLanguage[input.language];
  const normalizedCv = normalizeText(input.cvText);
  const normalizedJob = normalizeText(input.jobText);
  const activeRequirements = requirementBank.filter((requirement) => hasAnyPattern(normalizedJob, requirement.patterns));

  const requirements: AssessedRequirement[] = activeRequirements.map((requirement) => {
    const directMatch = hasAnyPattern(normalizedCv, requirement.patterns);
    const relatedMatch = requirement.relatedPatterns
      ? hasAnyPattern(normalizedCv, requirement.relatedPatterns)
      : false;
    const status: RequirementStatus = directMatch
      ? ["english", "ai_experience"].includes(requirement.id) ? "parcial" : "si"
      : relatedMatch
        ? "parcial"
        : "unknown";
    const label = copy.requirements[requirement.id];
    const answer = input.clarifications?.find((answer) => answer.requirementId === requirement.id ||
      normalizeText(answer.requirement) === normalizeText(label) ||
      hasAnyPattern(normalizeText(answer.requirement), requirement.patterns));
    const result: AssessedRequirement = {
      id: requirement.id,
      label,
      category: requirement.category,
      categoryLabel: copy.categories[requirement.category],
      status,
      evidence: copy.evidence[status](label),
      evidenceSource: status === "unknown" ? "unknown" : "cv",
      weight: requirement.weight,
      question: requirement.id === "english"
        ? input.language === "es" ? "¿Cuál es tu nivel de inglés y en qué situaciones lo has utilizado?" : "What is your English level, and in which situations have you used it?"
        : requirement.id === "ai_interest"
          ? input.language === "es" ? "¿Qué te interesa de la IA? Puedes mencionar herramientas, cursos o proyectos personales." : "What interests you about AI? You can mention tools, courses or personal projects."
          : null
    };
    if (answer) {
      result.answerId = answer.requirementId;
      result.evidenceSource = "user";
      // Keyword matching cannot establish that a self-reported level meets the advert.
      result.status = answer.response === "no" ? "no" : "parcial";
      result.evidence = answer.response === "no" ? copy.evidence.no(label) : input.language === "es"
        ? `Información aportada por ti: ${answer.details}. La revisión básica no puede comprobar el nivel exigido por la oferta.`
        : `Information supplied by you: ${answer.details}. The basic review cannot check the level required by the advert.`;
    }
    return result;
  });
  const conditions = [...new Set(input.jobText.split(/\n|;|(?<=[.!?])\s+/)
    .map((part) => part.replace(/^[\s*•-]+/, "").trim())
    // Never truncate a practical condition: a qualifier could change its meaning.
    .filter((part) => part.length > 0 && part.length <= 160 && isPracticalCondition(part)))];
  for (const [index, label] of conditions.entries()) {
    if (requirements.length >= 12) break;
    const id = `condition-${index + 1}`;
    const answer = input.clarifications?.find((candidate) => candidate.requirementId === id && candidate.requirement === label);
    requirements.push({
      id, label, kind: "condition", category: "required", categoryLabel: copy.categories.required,
      status: "unknown", evidence: copy.evidence.unknown(label), evidenceSource: "unknown", weight: 1,
      cvAssessability: "no", clarificationMaterial: true, answerId: answer?.requirementId
    });
  }
  return buildReport(input, inferRoleTitle(input.jobText, copy), requirements, "heuristic");
}
