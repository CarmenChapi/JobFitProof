import { describe, expect, it } from "vitest";
import { parseAnalysisInput } from "../../frontend/lib/analysis-input";
import { createAnalysisSchema } from "../src/modules/analyses/analysis.schema.js";
import { sampleInput } from "./helpers.js";

const answer = { requirementId: "english", requirement: "Professional English", response: "yes", details: "B2; weekly client meetings." };
const cases: { name: string; input: unknown; accepted: boolean }[] = [
  ...[
    { name: "empty final answers", value: [], accepted: true },
    { name: "valid answer", value: [answer], accepted: true },
    { name: "negative answer without details", value: [{ ...answer, response: "no", details: "" }], accepted: true },
    { name: "trimmed answer", value: [{ ...answer, requirementId: " english ", details: " B2 " }], accepted: true },
    { name: "partial answer", value: [{ ...answer, response: "partly" }], accepted: true },
    { name: "three answers", value: [0, 1, 2].map((id) => ({ ...answer, requirementId: String(id) })), accepted: true },
    { name: "four answers", value: [0, 1, 2, 3].map((id) => ({ ...answer, requirementId: String(id) })), accepted: true },
    { name: "twelve answers", value: Array.from({ length: 12 }, (_, id) => ({ ...answer, requirementId: String(id) })), accepted: true },
    { name: "thirteen answers", value: Array.from({ length: 13 }, (_, id) => ({ ...answer, requirementId: String(id) })), accepted: false },
    { name: "explicit evidence kind", value: [{ ...answer, kind: "evidence" }], accepted: true },
    { name: "condition yes without details", value: [{ ...answer, kind: "condition", details: "" }], accepted: true },
    { name: "condition no without details", value: [{ ...answer, kind: "condition", response: "no", details: "" }], accepted: true },
    { name: "condition depends with details", value: [{ ...answer, kind: "condition", response: "partly" }], accepted: true },
    { name: "condition depends without details", value: [{ ...answer, kind: "condition", response: "partly", details: "" }], accepted: false },
    { name: "skill yes without details", value: [{ ...answer, kind: "evidence", details: "" }], accepted: false },
    { name: "unsupported kind", value: [{ ...answer, kind: "qualification" }], accepted: false },
    { name: "duplicate answers", value: [answer, { ...answer, requirementId: " english " }], accepted: false },
    { name: "null answers", value: null, accepted: false },
    { name: "object answers", value: {}, accepted: false },
    { name: "null answer", value: [null], accepted: false },
    { name: "injected score", value: [{ ...answer, score: 100 }], accepted: false },
    { name: "invalid response", value: [{ ...answer, response: "skip" }], accepted: false },
    { name: "array response", value: [{ ...answer, response: ["yes"] }], accepted: false },
    { name: "affirmation without evidence", value: [{ ...answer, details: "   " }], accepted: false },
    ...[["requirementId", 80], ["requirement", 160], ["details", 1000]].flatMap(([key, limit]) => [
      { name: `${key} at limit`, value: [{ ...answer, [key]: "x".repeat(Number(limit)) }], accepted: true },
      { name: `${key} too long`, value: [{ ...answer, [key]: "x".repeat(Number(limit) + 1) }], accepted: false },
      { name: `${key} missing`, value: [{ ...answer, [key]: undefined }], accepted: false }
    ])
  ].map(({ name, value, accepted }) => ({ name: `clarifications: ${name}`, input: { ...sampleInput, clarifications: value }, accepted })),
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
