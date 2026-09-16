# JobFit Proof API

Backend API for JobFit Proof.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

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
  plugins/cors.ts     Shared CORS plugin registration.
  routes/health.ts    Healthcheck endpoint.
  routes/v1/index.ts  Versioned API routes.
tests/
  health.test.ts      API smoke tests.
```

## Endpoints

- `GET /health`
- `GET /api/v1`
