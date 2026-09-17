export type Language = "es" | "en";

export const defaultLanguage: Language = "es";

export const languages: Array<{
  code: Language;
  shortLabel: string;
  label: string;
}> = [
  { code: "es", shortLabel: "ES", label: "Español" },
  { code: "en", shortLabel: "EN", label: "English" },
];

export const translations = {
  es: {
    appSubtitle: "Evidencia clara antes de postular",
    language: {
      label: "Idioma",
      es: "Español",
      en: "Inglés",
      switchTo: "Cambiar idioma a",
    },
    actions: {
      sample: "Ejemplo",
      clear: "Limpiar",
      analyze: "Analizar",
      analyzing: "Analizando...",
      export: "Exportar",
      resetInputs: "Reiniciar entradas",
    },
    form: {
      title: "Material de postulación",
      badge: "API conectada",
      cvLabel: "CV",
      cvPlaceholder: "Pega aquí el texto del CV.",
      jobLabel: "Oferta",
      jobPlaceholder: "Pega aquí la descripción del puesto.",
      seniority: "Seniority objetivo",
      minWarning: "Necesito al menos 80 caracteres en cada campo para generar un reporte.",
      analysisError: "No se pudo generar el reporte. Comprueba que el backend está funcionando.",
      wordCount: (count: number) => `${count} ${count === 1 ? "palabra" : "palabras"}`,
    },
    report: {
      title: "Reporte de encaje",
      matchScore: "Puntaje de encaje",
      roleFallback: "Rol objetivo",
      requirementsMetric: "Requisitos",
      strengthsMetric: "Fortalezas",
      gapsMetric: "Brechas",
      requirementsValue: (count: number) => `${count} ${count === 1 ? "evaluado" : "evaluados"}`,
      strengthsValue: (count: number) => `${count} ${count === 1 ? "fuerte" : "fuertes"}`,
      noCriticalGaps: "Sin brechas críticas",
      evidenceTitle: "Evidencia por requisito",
      statusTitle: "Estado",
      nextTitle: "Siguiente mejora sugerida",
      filenameFallback: "reporte",
      highSummary: "Buen encaje inicial. El CV ya muestra varias pruebas fuertes para esta oferta.",
      midSummary: "Encaje prometedor, con brechas que se pueden mejorar antes de postular.",
      lowSummary: "Conviene reforzar evidencia clave antes de aplicar a esta posición.",
      improve: (gap: string) =>
        `Refuerza ${gap.toLowerCase()} con una frase que incluya contexto, acción e impacto.`,
      ready: "El CV está listo para una versión final orientada a esta oferta.",
    },
    status: {
      si: "Cumple",
      parcial: "Parcial",
      no: "Brecha",
    },
    categories: {
      required: "excluyente",
      preferred: "deseable",
    },
    requirements: {
      react: "React en producto",
      typescript: "TypeScript en producción",
      next: "Next.js / SSR",
      api: "Integración con APIs",
      testing: "Testing frontend",
      accessibility: "Accesibilidad",
      performance: "Performance web",
      product: "Trabajo con producto",
      english: "Inglés profesional",
      leadership: "Liderazgo técnico",
    },
    evidence: {
      si: (label: string) => `Hay evidencia directa de ${label.toLowerCase()} en el CV.`,
      parcial: (label: string) =>
        `Aparecen señales relacionadas, pero conviene explicitar ${label.toLowerCase()} con impacto medible.`,
      no: (label: string) =>
        `No aparece una prueba clara de ${label.toLowerCase()} para este requisito.`,
    },
    samples: {
      cv: `Frontend Developer con 4 años creando productos SaaS con React, TypeScript y Next.js.
He trabajado con APIs REST, diseño de componentes, accesibilidad WCAG y performance web.
En mi último rol reduje el tiempo de carga inicial un 32% y añadí tests con Jest y Playwright.
Colaboré con producto, diseño y backend para convertir requisitos ambiguos en entregas medibles.`,
      job: `Buscamos Frontend Developer React/TypeScript para un producto B2B.
Requisitos: 3+ años con React, TypeScript en producción, Next.js, consumo de APIs y testing.
Valoramos accesibilidad, foco en performance, comunicación con producto e inglés intermedio/avanzado.
Plus: experiencia guiando a otros developers o liderando iniciativas técnicas.`,
    },
  },
  en: {
    appSubtitle: "Clear evidence before you apply",
    language: {
      label: "Language",
      es: "Spanish",
      en: "English",
      switchTo: "Switch language to",
    },
    actions: {
      sample: "Sample",
      clear: "Clear",
      analyze: "Analyze",
      analyzing: "Analyzing...",
      export: "Export",
      resetInputs: "Reset inputs",
    },
    form: {
      title: "Application material",
      badge: "API connected",
      cvLabel: "Resume",
      cvPlaceholder: "Paste the resume text here.",
      jobLabel: "Job post",
      jobPlaceholder: "Paste the job description here.",
      seniority: "Target seniority",
      minWarning: "I need at least 80 characters in each field to generate a report.",
      analysisError: "The report could not be generated. Check that the backend is running.",
      wordCount: (count: number) => `${count} ${count === 1 ? "word" : "words"}`,
    },
    report: {
      title: "Fit report",
      matchScore: "Match score",
      roleFallback: "Target role",
      requirementsMetric: "Requirements",
      strengthsMetric: "Strengths",
      gapsMetric: "Gaps",
      requirementsValue: (count: number) => `${count} reviewed`,
      strengthsValue: (count: number) => `${count} strong`,
      noCriticalGaps: "No critical gaps",
      evidenceTitle: "Evidence by requirement",
      statusTitle: "Status",
      nextTitle: "Suggested next improvement",
      filenameFallback: "report",
      highSummary: "Strong initial fit. The resume already shows several solid proof points for this role.",
      midSummary: "Promising fit, with gaps that can be improved before applying.",
      lowSummary: "It is worth strengthening key evidence before applying to this role.",
      improve: (gap: string) =>
        `Strengthen ${gap.toLowerCase()} with a sentence that includes context, action, and impact.`,
      ready: "The resume is ready for a final version tailored to this role.",
    },
    status: {
      si: "Met",
      parcial: "Partial",
      no: "Gap",
    },
    categories: {
      required: "required",
      preferred: "preferred",
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
      leadership: "Technical leadership",
    },
    evidence: {
      si: (label: string) => `There is direct evidence of ${label.toLowerCase()} in the resume.`,
      parcial: (label: string) =>
        `Related signals appear, but ${label.toLowerCase()} should be stated with measurable impact.`,
      no: (label: string) =>
        `There is no clear proof of ${label.toLowerCase()} for this requirement.`,
    },
    samples: {
      cv: `Frontend Developer with 4 years building SaaS products with React, TypeScript, and Next.js.
I have worked with REST APIs, component systems, WCAG accessibility, and web performance.
In my latest role I reduced initial load time by 32% and added tests with Jest and Playwright.
I partnered with product, design, and backend teams to turn ambiguous requirements into measurable releases.`,
      job: `We are looking for a React/TypeScript Frontend Developer for a B2B product.
Requirements: 3+ years with React, production TypeScript, Next.js, API consumption, and testing.
We value accessibility, performance focus, product communication, and intermediate/advanced English.
Bonus: experience guiding other developers or leading technical initiatives.`,
    },
  },
};

export type LanguageCopy = (typeof translations)[Language];
