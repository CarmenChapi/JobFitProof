import type {
  AnalysisLanguage,
  AnalysisReport,
  CreateAnalysisInput,
  RequirementCategory,
  RequirementStatus
} from "./analysis.schema.js";

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
    patterns: ["ingles", "inglés", "english", "b2", "c1", "advanced", "avanzado"],
    weight: 5
  },
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
      leadership: "Liderazgo técnico"
    },
    evidence: {
      si: (label) => `Hay evidencia directa de ${label.toLowerCase()} en el CV.`,
      parcial: (label) =>
        `Aparecen señales relacionadas, pero conviene explicitar ${label.toLowerCase()} con impacto medible.`,
      no: (label) => `No aparece una prueba clara de ${label.toLowerCase()} para este requisito.`
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
      leadership: "Technical leadership"
    },
    evidence: {
      si: (label) => `There is direct evidence of ${label.toLowerCase()} in the CV.`,
      parcial: (label) =>
        `Related signals appear, but ${label.toLowerCase()} should be stated with measurable impact.`,
      no: (label) => `There is no clear evidence of ${label.toLowerCase()} for this requirement.`
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
  return patterns.some((pattern) => text.includes(normalizeText(pattern)));
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
  const jobHasKnownRequirements = requirementBank.some((requirement) =>
    hasAnyPattern(normalizedJob, requirement.patterns)
  );

  const activeRequirements = requirementBank.filter((requirement, index) => {
    if (!jobHasKnownRequirements) {
      return index < 6;
    }

    return (
      hasAnyPattern(normalizedJob, requirement.patterns) ||
      ["react", "typescript", "api"].includes(requirement.id)
    );
  });

  const requirements = activeRequirements.map((requirement) => {
    const directMatch = hasAnyPattern(normalizedCv, requirement.patterns);
    const relatedMatch = requirement.relatedPatterns
      ? hasAnyPattern(normalizedCv, requirement.relatedPatterns)
      : false;
    const seniorLeadershipPartial =
      requirement.id === "leadership" && input.seniority !== "junior" && normalizedCv.length > 120;
    const status: RequirementStatus = directMatch
      ? "si"
      : relatedMatch || seniorLeadershipPartial
        ? "parcial"
        : "no";
    const label = copy.requirements[requirement.id];

    return {
      id: requirement.id,
      label,
      category: requirement.category,
      categoryLabel: copy.categories[requirement.category],
      status,
      evidence: copy.evidence[status](label),
      weight: requirement.weight
    };
  });

  const totalWeight = requirements.reduce((sum, requirement) => sum + requirement.weight, 0);
  const earnedWeight = requirements.reduce((sum, requirement) => {
    if (requirement.status === "si") {
      return sum + requirement.weight;
    }

    if (requirement.status === "parcial") {
      return sum + requirement.weight * 0.48;
    }

    return sum;
  }, 0);
  const seniorityAdjustment =
    input.seniority === "senior" &&
    !hasAnyPattern(normalizedCv, [
      "lider",
      "líder",
      "lead",
      "leadership",
      "arquitectura",
      "architecture"
    ])
      ? -5
      : input.seniority === "junior"
        ? 3
        : 0;
  const score = Math.max(
    8,
    Math.min(96, Math.round((earnedWeight / Math.max(totalWeight, 1)) * 100 + seniorityAdjustment))
  );
  const matchedRequirements = requirements.filter((requirement) => requirement.status === "si");
  const gaps = requirements
    .filter((requirement) => requirement.status !== "si")
    .slice(0, 3)
    .map((requirement) => requirement.label);

  return {
    generatedAt: new Date().toISOString(),
    language: input.language,
    seniority: input.seniority,
    roleTitle: inferRoleTitle(input.jobText, copy),
    score,
    summary:
      score >= 78 ? copy.summaries.high : score >= 55 ? copy.summaries.mid : copy.summaries.low,
    strengths: matchedRequirements.slice(0, 4).map((requirement) => requirement.label),
    gaps,
    requirements,
    source: "heuristic"
  };
}
