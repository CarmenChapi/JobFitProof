import { env } from "../../config/env.js";
import { createAiAnalysis } from "./analysis.ai.service.js";
import { createHeuristicAnalysis } from "./analysis.heuristic.service.js";
import type { AnalysisReport, CreateAnalysisInput } from "./analysis.schema.js";

export async function createAnalysis(input: CreateAnalysisInput): Promise<AnalysisReport> {
  if (env.NODE_ENV === "test") {
    return createHeuristicAnalysis(input);
  }

  try {
    return await createAiAnalysis(input);
  } catch {
    console.error("AI analysis failed; using heuristic fallback");
    return createHeuristicAnalysis(input);
  }
}
