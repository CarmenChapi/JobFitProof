import { vi } from "vitest";
import type { AnalysisQuotaStore } from "../src/modules/analyses/analysis.quota.js";

export const serviceHeaders = {
  authorization: `Bearer ${"a".repeat(64)}`,
  "x-jobfit-client": "b".repeat(64)
};

export const sampleInput = {
  cvText: "Frontend developer with four years of React, TypeScript, REST APIs and automated tests using Vitest.",
  jobText: "Frontend developer required with experience of React, TypeScript, REST APIs and automated testing.",
  seniority: "mid" as const,
  language: "en" as const
};

// Format-only fixture for parser/proxy tests; authenticated API tests use real contexts.
export const sampleReviewToken = `v1.${"a".repeat(16)}.fixture.${"a".repeat(22)}`;

export function createQuotaStore() {
  return {
    acquire: vi.fn<AnalysisQuotaStore["acquire"]>().mockResolvedValue({
      allowed: true,
      reservationId: "test-reservation"
    }),
    release: vi.fn<AnalysisQuotaStore["release"]>().mockResolvedValue(undefined),
    close: vi.fn<AnalysisQuotaStore["close"]>().mockResolvedValue(undefined)
  };
}
