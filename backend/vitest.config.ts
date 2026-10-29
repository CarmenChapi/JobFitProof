import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      INTERNAL_API_SECRET: "a".repeat(64),
      REDIS_URL: "redis://127.0.0.1:6379",
      OPENAI_API_KEY: ""
    },
    include: ["tests/**/*.test.ts"]
  }
});
