# JobFit Proof API

Backend API for JobFit Proof.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

Set `OPENAI_API_KEY` in `.env` before starting the server. The analysis endpoint uses
the OpenAI Responses API with Structured Outputs and defaults to `gpt-5-mini`.
`OPENAI_MODEL` and `OPENAI_TIMEOUT_MS` can be changed in `.env`.

If the API key is missing or OpenAI is temporarily unavailable, the endpoint returns
the local heuristic analysis with `source: "heuristic"`. Successful AI analyses return
`source: "ai"`. Test runs always use the heuristic and never call the external API.

The API runs on `http://localhost:4000` by default.

## Scripts

- `npm run dev`: start the API in watch mode.
- `npm run build`: compile TypeScript to `dist/`.
- `npm start`: run the compiled API.
- `npm run typecheck`: check TypeScript without emitting files.
- `npm test`: run the test suite.

## Structure

```text
src/
  app.ts              Fastify app factory.
  server.ts           Process entrypoint.
  config/env.ts       Environment validation and defaults.
  modules/analyses/   Analysis contract, service, and HTTP route.
  plugins/cors.ts     Shared CORS plugin registration.
  routes/health.ts    Healthcheck endpoint.
  routes/v1/index.ts  Versioned API routes.
tests/
  health.test.ts      API smoke tests.
```

## Endpoints

- `GET /health`
- `GET /api/v1`
- `POST /api/v1/analyses`

### Create an analysis

```bash
curl -X POST http://localhost:4000/api/v1/analyses \
  -H 'content-type: application/json' \
  -d '{
    "cvText": "CV text with at least 80 characters...",
    "jobText": "Job description text with at least 80 characters...",
    "seniority": "mid",
    "language": "en"
  }'
```

`seniority` accepts `junior`, `mid`, or `senior`. `language` accepts `es` or `en` and defaults to `es`.
