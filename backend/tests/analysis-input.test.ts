import { describe, expect, it } from "vitest";
import { parseAnalysisInput } from "../../frontend/lib/analysis-input";
import { createAnalysisSchema } from "../src/modules/analyses/analysis.schema.js";
import { sampleInput } from "./helpers.js";

const cases: { name: string; input: unknown; accepted: boolean }[] = [
  { name: "valid input", input: sampleInput, accepted: true },
  { name: "null", input: null, accepted: false },
  { name: "an array", input: [sampleInput], accepted: false },
  { name: "a string", input: "invalid", accepted: false },
  { name: "an empty object", input: {}, accepted: false },
  { name: "an unknown field", input: { ...sampleInput, userId: "forged" }, accepted: false },
  { name: "missing seniority", input: { ...sampleInput, seniority: undefined }, accepted: false },
  { name: "unsupported seniority", input: { ...sampleInput, seniority: "lead" }, accepted: false },
  { name: "missing language defaults to Spanish", input: { ...sampleInput, language: undefined }, accepted: true },
  { name: "null language", input: { ...sampleInput, language: null }, accepted: false },
  { name: "unsupported language", input: { ...sampleInput, language: "fr" }, accepted: false },
  ...["junior", "mid", "senior"].flatMap((seniority) => ["es", "en"].map((language) => ({
    name: `${seniority} in ${language}`, input: { ...sampleInput, seniority, language }, accepted: true
  }))),
  ...["cvText", "jobText"].flatMap((field) => [
    { name: `${field} is missing`, input: { ...sampleInput, [field]: undefined }, accepted: false },
    { name: `${field} is a number`, input: { ...sampleInput, [field]: 100 }, accepted: false },
    { name: `${field} is whitespace`, input: { ...sampleInput, [field]: " ".repeat(80) }, accepted: false },
    { name: `${field} is trimmed`, input: { ...sampleInput, [field]: ` \n${"x".repeat(80)}\t ` }, accepted: true },
    ...[79, 80, 50_000, 50_001].map((length) => ({
      name: `${field} has ${length} characters`,
      input: { ...sampleInput, [field]: "x".repeat(length) },
      accepted: length >= 80 && length <= 50_000
    }))
  ])
];

describe("frontend and backend analysis input contract", () => {
  it.each(cases)("agrees on $name", ({ input, accepted }) => {
    const backend = createAnalysisSchema.safeParse(input);
    expect(backend.success).toBe(accepted);
    expect(parseAnalysisInput(input)).toEqual(backend.success ? backend.data : null);
  });
});
