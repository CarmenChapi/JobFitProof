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
    appSubtitle: "Evidencia clara antes de presentar tu candidatura",
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
      title: "Documentación de la candidatura",
      badge: "API conectada",
      cvLabel: "CV",
      cvPlaceholder: "Pega aquí el texto del CV.",
      jobLabel: "Oferta de empleo",
      jobPlaceholder: "Pega aquí la descripción de la oferta de empleo.",
      seniority: "Nivel profesional objetivo",
      minWarning: "Cada campo debe contener entre 80 y 50.000 caracteres, sin contar los espacios al principio y al final.",
      invalidInput: "Revisa los textos (entre 80 y 50.000 caracteres) y las respuestas adicionales (hasta 1.000 caracteres). Añade un ejemplo si indicas que cumples un requisito.",
      uploadTimeout: "La carga ha tardado demasiado. Tus textos se conservan; comprueba la conexión y vuelve a intentarlo.",
      analysisError: "El análisis no está disponible temporalmente. Tus textos se conservan; inténtalo más tarde.",
      analysisBusy: "Hay otros análisis en curso. Espera unos segundos y vuelve a intentarlo.",
      dailyLimit: "Se ha alcanzado el límite diario de análisis. Vuelve a intentarlo mañana.",
      rateLimit: (seconds: number) => `Has alcanzado el límite de análisis. Vuelve a intentarlo en ${Math.ceil(seconds / 60)} min.`,
      wordCount: (count: number) => `${count} ${count === 1 ? "palabra" : "palabras"}`,
    },
    clarification: {
      title: "Aclaremos lo que falta en el CV",
      description: "Estas preguntas son opcionales. No mencionar algo en el CV no significa que no lo cumplas. Responde a lo que puedas antes de ver el informe final.",
      response: "¿Cumples este requisito?",
      skipQuestion: "No lo sé / prefiero omitirlo",
      yes: "Sí",
      partly: "En parte",
      no: "Todavía no",
      details: "Tu nivel o un ejemplo concreto",
      optionalDetails: "Contexto adicional (opcional)",
      placeholder: "Por ejemplo, tu nivel de inglés y cómo lo usas, o un curso o proyecto relacionado.",
      finish: "Ver informe final",
      skipAll: "Continuar sin responder",
      disclosure: "Tus respuestas se usarán para actualizar el informe y aparecerán como información aportada por ti. No se añadirán automáticamente al CV.",
    },
    provenance: { cv: "Evidencia en el CV", user: "Información aportada por ti", unknown: "Sin información suficiente" },
    report: {
      title: "Informe de adecuación",
      matchScore: "Respaldo de los requisitos",
      scoreHelp: "Puntuación ponderada según el CV y tus respuestas: respaldo suficiente suma el peso completo y parcial, la mitad. Lo desconocido no suma, pero no se considera una carencia confirmada.",
      pending: "Por aclarar",
      partial: "Evidencia parcial",
      addToCv: "Información que puedes añadir al CV",
      addToCvHelp: "Si refleja tu experiencia, incorpora estos datos con tu nivel y un ejemplo concreto:",
      unknownHelp: "Completa estos datos antes de valorar tu adecuación. Omitir una pregunta no confirma una carencia.",
      fallback: "Revisión básica: solo reconoce algunos requisitos y no comprueba niveles ni contexto. Las respuestas positivas se mantienen como evidencia parcial.",
      noRequirements: "No se han podido identificar requisitos evaluables. Revisa la descripción de la oferta.",
      unassessed: "No se han podido evaluar estas respuestas. Revísalas manualmente; no se han usado para cambiar la puntuación:",
      roleFallback: "Rol objetivo",
      requirementsMetric: "Requisitos",
      strengthsMetric: "Fortalezas",
      gapsMetric: "Carencias",
      requirementsValue: (count: number) => `${count} ${count === 1 ? "evaluado" : "evaluados"}`,
      strengthsValue: (count: number) => `${count} ${count === 1 ? "fuerte" : "fuertes"}`,
      noCriticalGaps: "Sin carencias confirmadas",
      evidenceTitle: "Evidencia por requisito",
      statusTitle: "Estado",
      nextTitle: "Siguiente mejora sugerida",
      filenameFallback: "informe",
      highSummary: "Buen encaje inicial. El CV ya muestra varias pruebas fuertes para esta oferta.",
      midSummary: "Adecuación prometedora, con aspectos que se pueden mejorar antes de presentar la candidatura.",
      lowSummary: "Conviene reforzar las evidencias clave antes de presentar la candidatura a este puesto.",
      improve: (gap: string) =>
        `Busca formación o práctica para reforzar ${gap.toLowerCase()}. Añade al CV solo conocimientos o experiencia que puedas respaldar.`,
      ready: "Revisa la evidencia de cada requisito y adapta el CV con información que puedas respaldar.",
    },
    status: {
      si: "Cumple",
      parcial: "Cumple parcialmente",
      no: "No cumple",
      unknown: "Por aclarar",
    },
    categories: {
      required: "imprescindible",
      preferred: "valorable",
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
He trabajado con API REST, diseño de componentes, accesibilidad WCAG y rendimiento web.
En mi último puesto reduje el tiempo de carga inicial un 32 % y añadí pruebas con Jest y Playwright.
Colaboré con producto, diseño y backend para convertir requisitos ambiguos en entregas medibles.`,
      job: `Buscamos Frontend Developer React/TypeScript para un producto B2B.
Requisitos: más de 3 años con React, TypeScript en producción, Next.js, consumo de API y pruebas automatizadas.
Valoramos la accesibilidad, la atención al rendimiento, la comunicación con producto y un nivel de inglés intermedio o avanzado.
También se valorará la experiencia orientando a otros desarrolladores o liderando iniciativas técnicas.`,
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
      analyze: "Analyse",
      analyzing: "Analysing...",
      export: "Export",
      resetInputs: "Reset inputs",
    },
    form: {
      title: "Application material",
      badge: "API connected",
      cvLabel: "CV",
      cvPlaceholder: "Paste the CV text here.",
      jobLabel: "Job advert",
      jobPlaceholder: "Paste the job advert here.",
      seniority: "Target level",
      minWarning: "Each field must contain between 80 and 50,000 characters, excluding leading and trailing whitespace.",
      invalidInput: "Check the texts (80–50,000 characters) and additional answers (up to 1,000 characters). Add an example when you say you meet a requirement.",
      uploadTimeout: "The upload took too long. Your text is preserved; check your connection and try again.",
      analysisError: "Analysis is temporarily unavailable. Your text is preserved; please try again later.",
      analysisBusy: "Other analyses are in progress. Please wait a few seconds and try again.",
      dailyLimit: "The daily analysis limit has been reached. Please try again tomorrow.",
      rateLimit: (seconds: number) => `You have reached the analysis limit. Please try again in ${Math.ceil(seconds / 60)} min.`,
      wordCount: (count: number) => `${count} ${count === 1 ? "word" : "words"}`,
    },
    clarification: {
      title: "Clarify what is missing from your CV",
      description: "These questions are optional. Leaving something out of your CV does not mean you cannot do it. Answer what you can before viewing the final report.",
      response: "Do you meet this requirement?",
      skipQuestion: "Not sure / prefer to skip",
      yes: "Yes",
      partly: "Partly",
      no: "Not yet",
      details: "Your level or a specific example",
      optionalDetails: "Additional context (optional)",
      placeholder: "For example, your English level and how you use it, or a relevant course or project.",
      finish: "View final report",
      skipAll: "Continue without answering",
      disclosure: "Your answers will update the report and be labelled as information supplied by you. They will not be added to your CV automatically.",
    },
    provenance: { cv: "Evidence in your CV", user: "Information supplied by you", unknown: "Not enough information" },
    report: {
      title: "Fit report",
      matchScore: "Requirements supported",
      scoreHelp: "Weighted score based on your CV and answers: sufficient support earns full weight and partial support earns half. Unknowns earn no credit but are not confirmed gaps.",
      pending: "Needs clarification",
      partial: "Partial evidence",
      addToCv: "Information you could add to your CV",
      addToCvHelp: "If it reflects your experience, add these details with your level and a specific example:",
      unknownHelp: "Clarify these points before judging your fit. Skipping a question does not confirm a gap.",
      fallback: "Basic review: recognises only some requirements and cannot check levels or context. Positive answers remain partial evidence.",
      noRequirements: "No assessable requirements were identified. Check the job description.",
      unassessed: "These answers could not be assessed. Review them manually; they have not been used to change the score:",
      roleFallback: "Target role",
      requirementsMetric: "Requirements",
      strengthsMetric: "Strengths",
      gapsMetric: "Gaps",
      requirementsValue: (count: number) => `${count} reviewed`,
      strengthsValue: (count: number) => `${count} strong`,
      noCriticalGaps: "No confirmed gaps",
      evidenceTitle: "Evidence by requirement",
      statusTitle: "Status",
      nextTitle: "Suggested next improvement",
      filenameFallback: "report",
      highSummary: "Strong initial fit. The CV already provides several clear examples of relevant experience for this role.",
      midSummary: "Promising fit, with gaps that can be improved before applying.",
      lowSummary: "It is worth strengthening key evidence before applying to this role.",
      improve: (gap: string) =>
        `Choose a learning or practice step to strengthen ${gap.toLowerCase()}. Only add skills or experience you can support to your CV.`,
      ready: "Review the evidence for each requirement and tailor your CV using information you can support.",
    },
    status: {
      si: "Met",
      parcial: "Partial",
      no: "Gap",
      unknown: "Needs clarification",
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
      si: (label: string) => `There is direct evidence of ${label.toLowerCase()} in the CV.`,
      parcial: (label: string) =>
        `Related signals appear, but ${label.toLowerCase()} should be stated with measurable impact.`,
      no: (label: string) =>
        `There is no clear evidence of ${label.toLowerCase()} for this requirement.`,
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
