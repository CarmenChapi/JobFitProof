import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  INTERNAL_API_SECRET: z.string().regex(/^[a-f0-9]{64}$/),
  REDIS_URL: z.url().refine((value) => ["redis:", "rediss:"].includes(new URL(value).protocol)),
  ANALYSIS_RATE_LIMIT: z.coerce.number().int().positive().default(3),
  ANALYSIS_WINDOW_SECONDS: z.coerce.number().int().positive().default(600),
  ANALYSIS_DAILY_LIMIT: z.coerce.number().int().positive().default(10),
  ANALYSIS_GLOBAL_DAILY_LIMIT: z.coerce.number().int().positive().default(50),
  ANALYSIS_MAX_CONCURRENT: z.coerce.number().int().positive().default(2),
  OPENAI_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(30_000)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
