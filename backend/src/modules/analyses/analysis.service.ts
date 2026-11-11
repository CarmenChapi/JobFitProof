import { APIConnectionError, APIConnectionTimeoutError, APIUserAbortError, AuthenticationError, RateLimitError } from "openai/error";

import { env } from "../../config/env.js";
import { createAiAnalysis } from "./analysis.ai.service.js";
import { createHeuristicAnalysis } from "./analysis.heuristic.service.js";
import type { AnalysisReport, CreateAnalysisInput } from "./analysis.schema.js";
import { reviewAnalysis } from "./analysis.review.js";

export async function createAnalysis(input: CreateAnalysisInput, baseline?: AnalysisReport): Promise<AnalysisReport> {
  if (input.clarifications !== undefined) {
    if (!baseline) throw new Error("Clarification review requires the original analysis");
    return reviewAnalysis(input, baseline);
  }
  if (env.NODE_ENV === "test") {
    return createHeuristicAnalysis(input);
  }

  try {
    return await createAiAnalysis(input);
  } catch (error) {
    // Log a fixed category only: provider errors may contain submitted text or credentials.
    const reason = error instanceof APIConnectionTimeoutError || error instanceof APIUserAbortError
      ? "timeout"
      : error instanceof RateLimitError
        ? "rate_limit"
        : error instanceof AuthenticationError
          ? "authentication"
          : error instanceof APIConnectionError
            ? "connection"
            : "invalid_or_unavailable_response";
    console.error("AI analysis failed; using heuristic fallback", { reason });
    return createHeuristicAnalysis(input);
  }
}
