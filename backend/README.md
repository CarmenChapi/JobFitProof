# JobFit Proof API

Backend API for JobFit Proof.

## Getting Started

```bash
npm ci
cp .env.example .env
```

Generate a service secret with `openssl rand -hex 32`. Set the same value as
`INTERNAL_API_SECRET` in this backend's `.env` and the frontend's `.env.local`.
The secret is required, must contain 64 lower-case hexadecimal characters, and must
never use a `NEXT_PUBLIC_` prefix or be committed to Git.

Start a local Redis instance from the repository root:

```bash
docker compose -f compose.redis.yml up -d
```

The Compose configuration binds Redis to loopback and persists its data in a named
volume with AOF and `appendfsync always`. Set `REDIS_URL` in `.env`, then run
`npm run dev` from `backend/`. An existing Redis service can be used instead of Docker.

Set `OPENAI_API_KEY` in `.env` to enable AI analysis. The analysis endpoint uses
the OpenAI Responses API with Structured Outputs and defaults to `gpt-5-mini`.
`OPENAI_MODEL` and `OPENAI_TIMEOUT_MS` can be changed in `.env`.
Automatic AI retries are disabled so each admitted analysis makes at most one AI
request. The timeout is also applied as an abort signal.

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

Check dependency advisories, including test tools, with `npm audit`.
Use `npm audit --omit=dev` to inspect production dependencies separately.
After updates, commit both `package.json` and `package-lock.json`, then run
`npm run build` and `npm test`. Install the frontend dependencies as well: the
test suite imports the Next.js proxy and its input validator. Redis integration
tests require `REDIS_TEST_URL` pointing to a test Redis instance.

## Structure

```text
src/
  app.ts              Fastify app factory.
  server.ts           Process entrypoint.
  config/env.ts       Environment validation and defaults.
  modules/analyses/   Routes, authentication, controller, quotas, schemas, and services.
  plugins/cors.ts     Shared CORS plugin registration.
  routes/health.ts    Healthcheck endpoint.
  routes/v1/index.ts  Versioned API routes.
tests/               API, security, proxy, and Redis integration tests.
```

## Endpoints

- `GET /health`
- `GET /api/v1`
- `POST /api/v1/analyses`

### Create an analysis

```bash
curl -X POST http://localhost:4000/api/v1/analyses \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $INTERNAL_API_SECRET" \
  -H 'x-jobfit-client: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' \
  -d '{
    "cvText": "CV text with at least 80 characters...",
    "jobText": "Job description text with at least 80 characters...",
    "seniority": "mid",
    "language": "en"
  }'
```

`seniority` accepts `junior`, `mid`, or `senior`. `language` accepts `es` or `en` and defaults to `es`.

The direct request above is for local diagnostics, with `INTERNAL_API_SECRET`
exported in the shell. Normal visitors use the Next.js `/api/analyze` endpoint;
Next.js supplies the service credentials and a pseudonymous client identifier.

## Analysis protection

The backend authenticates the service secret before parsing analysis request bodies.
The controller validates input, reserves quota, runs the service, then releases the
concurrency slot. The service coordinates the AI integration and heuristic fallback.
Health endpoints remain public and do not contact Redis.

| Variable | Default | Scope |
| --- | --- | --- |
| `ANALYSIS_RATE_LIMIT` | 3 | Admitted analyses per client per short window |
| `ANALYSIS_WINDOW_SECONDS` | 600 | Short window, starting with the first admission |
| `ANALYSIS_DAILY_LIMIT` | 10 | Admitted analyses per client per UTC day |
| `ANALYSIS_GLOBAL_DAILY_LIMIT` | 50 | Admitted analyses across all clients per UTC day |
| `ANALYSIS_MAX_CONCURRENT` | 2 | In-progress analyses across all backend instances |

All instances must share the same Redis database and limits. One Lua operation
checks and reserves all quotas atomically, using Redis time. Invalid inputs,
unauthorised requests, and rejected reservations do not consume these quotas.
Admitted attempts remain charged to the counters even if the AI request fails or
returns the heuristic fallback. These are request quotas, not monetary budgets.

Concurrency reservations have unique IDs and expire after `OPENAI_TIMEOUT_MS` plus
60 seconds if a process crashes. Releasing a slot does not refund daily or short-window
quota. If release fails, the reservation remains until it expires. This bounds work
tracked by the application; cancellation cannot guarantee that a remote provider
has already stopped processing a request.

Redis failures return `503` before analysis begins. There is no in-memory fallback.
Limits return `429`, a stable error code, and `Retry-After`. Configure Redis with
persistence and a `noeviction` policy; data loss, eviction, or deleting the volume
would reset counters. Redis should be private, authenticated, and use TLS when
accessed across hosts. Use separate Redis databases for different environments.

Redis stores counters, expiring reservation IDs, and HMAC-derived client identifiers.
It does not store CVs, job adverts, or raw client IP addresses. IP-derived identifiers
are pseudonymous rather than anonymous. Rotating the service secret changes the
per-client identifiers but does not reset the global daily counter.

## Production configuration

Keep the backend private where possible. If it has a public HTTPS address, every
analysis request still requires the service secret. Rotate the secret in both
services together. The secret authenticates Next.js; it does not authenticate a
visitor. Visitor abuse is controlled by the quotas.

The frontend also needs `APP_ORIGIN` and a trustworthy, single-IP ingress header;
see its README. Do not allow clients to bypass the ingress that sets that header.
The frontend requires HTTPS for backend connections outside loopback.

Set `BACKEND_TIMEOUT_MS` on the frontend above `OPENAI_TIMEOUT_MS` plus the Redis
connection/command allowance. Defaults are 40 and 30 seconds respectively.
Provider spending limits must be configured separately in OpenAI by the project owner.

## Security checks

API errors use controlled public codes and messages in every environment. The
global handler never returns exception names, stack traces, parser diagnostics
or dependency error messages. Missing and malformed URLs receive the same
protection; unknown routes and query strings are not echoed back. Validation
issues identify only supported fields and use fixed instructions.

Each request receives a server-generated UUID in `X-Request-Id`, also included
in errors from the global handler. Client-supplied request IDs are ignored.
Unexpected exceptions are logged on the server with that reference (`reqId`);
parser and other client errors are logged without their raw error messages.
Error responses use `Cache-Control: no-store`.

`npm test` exercises authentication, validation, fail-closed behaviour, forwarding,
IP normalisation, body limits, error sanitisation and quota error propagation
without calling OpenAI.

To additionally exercise atomic Lua reservations against a disposable Redis instance:

```bash
REDIS_TEST_URL=redis://127.0.0.1:6379 npm test
```

Integration tests use random key namespaces and remove only their own keys. They
cover multiple application instances, connection restarts, concurrent reservations,
daily quotas, expiring windows, and abandoned leases. They are skipped if
`REDIS_TEST_URL` is unset; use a dedicated local/test Redis instance.
