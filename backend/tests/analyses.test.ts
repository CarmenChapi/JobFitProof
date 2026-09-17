import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createApp() {
  const app = buildApp();
  apps.push(app);
  return app;
}

const validInput = {
  cvText:
    "Frontend Developer con cuatro años creando productos con React, TypeScript y Next.js. También he integrado APIs REST y escrito tests con Vitest.",
  jobText:
    "Buscamos Frontend Developer con experiencia sólida en React, TypeScript, Next.js, integración de API REST y pruebas automatizadas.",
  seniority: "mid",
  language: "es"
};

describe("POST /api/v1/analyses", () => {
  it("returns a localised fit report", async () => {
    const response = await createApp().inject({
      method: "POST",
      url: "/api/v1/analyses",
      payload: validInput
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      language: "es",
      seniority: "mid",
      roleTitle: "Frontend Developer",
      strengths: expect.arrayContaining(["React en producto", "TypeScript en producción"]),
      requirements: expect.arrayContaining([
        expect.objectContaining({ id: "react", status: "si" }),
        expect.objectContaining({ id: "typescript", status: "si" })
      ])
    });
    expect(response.json().score).toBeGreaterThanOrEqual(8);
    expect(response.json().score).toBeLessThanOrEqual(96);
    expect(Date.parse(response.json().generatedAt)).not.toBeNaN();
  });

  it("uses Spanish when language is omitted", async () => {
    const { language: _language, ...inputWithoutLanguage } = validInput;
    const response = await createApp().inject({
      method: "POST",
      url: "/api/v1/analyses",
      payload: inputWithoutLanguage
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().language).toBe("es");
  });

  it("rejects input that is too short", async () => {
    const response = await createApp().inject({
      method: "POST",
      url: "/api/v1/analyses",
      payload: {
        ...validInput,
        cvText: "React"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ValidationError",
      message: "Invalid analysis input",
      issues: [expect.objectContaining({ path: "cvText" })]
    });
  });

  it("rejects unsupported fields", async () => {
    const response = await createApp().inject({
      method: "POST",
      url: "/api/v1/analyses",
      payload: {
        ...validInput,
        userId: "not-supported-yet"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("ValidationError");
  });
});
