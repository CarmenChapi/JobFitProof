# JobFitProof — Backend

The JobFitProof backend is a Fastify API that assesses CV evidence against a job advert. It authenticates the frontend service, validates input, reserves shared usage quota, coordinates AI or heuristic analysis and calculates a structured report.

[Project overview and full setup](../README.md) · [Frontend documentation](../frontend/README.md)

## Responsibilities and architecture

The backend uses a feature-based structure. The analysis module contains its HTTP boundary, application logic, external integrations and report policy together.

| Layer | Responsibility |
| --- | --- |
| Routes | Register endpoints, authentication hooks and body limits. |
| Controller | Validate input, reserve quota, call the analysis service and release the concurrency slot. |
| Analysis service | Select AI analysis or the heuristic fallback. |
| AI adapter | Call OpenAI, validate structured output and associate candidate answers with requirements. |
| Heuristic service | Recognise a limited predefined vocabulary and some practical conditions locally. |
| Report policy | Normalise assessment decisions, calculate the skills score and generate clarification questions. |
| Quota store | Enforce shared request and concurrency limits through Redis. |
| Schemas and types | Define request validation and the report contract. |

There is no database-backed candidate model or repository layer because the application does not persist CVs, candidates or reports. Zod schemas validate incoming data, TypeScript types describe report data, and Redis stores operational quota state. This structure is deliberate and applies beyond local development.

### Technology

Node.js 22+, TypeScript, Fastify 5, Zod 4, the OpenAI JavaScript SDK, ioredis, dotenv and Vitest. The exact versions are recorded in [package.json](package.json) and the lockfile.

### Directory layout

```text
src/
├── server.ts                       Process entry point and HTTP listener
├── app.ts                          Application factory, plugins and dependencies
├── config/env.ts                   Environment validation
├── routes/
│   ├── health.ts                   Process health endpoint
│   └── v1/index.ts                 API version information and route registration
├── plugins/
│   ├── cors.ts                     Configured CORS policy
│   └── error-handler.ts            Controlled public errors and server logging
└── modules/analyses/
    ├── analysis.routes.ts          Analysis endpoint registration
    ├── analysis.auth.ts            Service credentials and client identity checks
    ├── analysis.controller.ts      Request orchestration and quota lifecycle
    ├── analysis.schema.ts          Input schema and public report types
    ├── analysis.service.ts         AI/fallback selection
    ├── analysis.ai.service.ts      OpenAI Structured Outputs integration
    ├── analysis.heuristic.service.ts Local keyword-based fallback
    ├── analysis.conditions.ts      Practical-condition recognition
    ├── analysis.report.ts          Assessment policy, score and questions
    ├── analysis.sources.ts         Source excerpt selection and location checks
    └── analysis.quota.ts           Redis connection and atomic quota reservation
tests/                             API, policy, proxy, contract and Redis tests
```

## Local development

The [root guide](../README.md#local-setup) covers both applications and Redis. The commands in this section run from `backend/`.

```bash
npm ci
test -f .env || cp .env.example .env
```

Set `INTERNAL_API_SECRET` to the same generated value as `frontend/.env.local`, configure `REDIS_URL`, and add `OPENAI_API_KEY` for AI analysis. The secret must contain exactly 64 lower-case hexadecimal characters. Generate it with `openssl rand -hex 32` and keep it out of source control.

Redis must be available before submitting an analysis. If using the supplied container, run the following from the **repository root**:

```bash
docker compose -f compose.redis.yml up -d
docker compose -f compose.redis.yml exec redis redis-cli ping
```

An existing local Redis service can be used instead. With the default URL, `redis-cli -h 127.0.0.1 -p 6379 ping` should return `PONG`.

Start the API from `backend/`:

```bash
npm run dev
```

It is available locally at [http://127.0.0.1:4000](http://127.0.0.1:4000). Check the process with:

```bash
curl -fsS http://127.0.0.1:4000/health
```

This health check does not contact Redis or OpenAI. A running process alone does not establish that an analysis can complete.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the TypeScript server in watch mode. |
| `npm run typecheck` | Check TypeScript without emitting files. |
| `npm run build` | Compile `src/` to `dist/`. |
| `npm start` | Run the compiled `dist/server.js`. |
| `npm test` | Run the Vitest suite. |

Restart the process after changing environment variables or pulling changes. When using `npm start`, rebuild first so the running JavaScript matches the current TypeScript source.

## Environment variables

Configuration is loaded from `.env` and validated at startup by [src/config/env.ts](src/config/env.ts). The backend exits if required configuration is missing or invalid.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` or `production`; test mode uses local analysis. |
| `HOST` | `0.0.0.0` | HTTP bind address. Set to `127.0.0.1` to restrict the listener to loopback. |
| `PORT` | `4000` | HTTP port. |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed browser origin. Set it to the frontend origin used in your environment. |
| `INTERNAL_API_SECRET` | None | Required shared service credential: 64 lower-case hexadecimal characters. |
| `REDIS_URL` | None | Required `redis://` or `rediss://` URL; the example file uses local port 6379. |
| `ANALYSIS_RATE_LIMIT` | `3` | Admitted requests per client per short window. |
| `ANALYSIS_WINDOW_SECONDS` | `600` | Duration of the short window. |
| `ANALYSIS_DAILY_LIMIT` | `10` | Admitted requests per client per UTC day. |
| `ANALYSIS_GLOBAL_DAILY_LIMIT` | `50` | Admitted requests across all clients per UTC day. |
| `ANALYSIS_MAX_CONCURRENT` | `2` | Active reservations across backend instances. |
| `OPENAI_API_KEY` | Unset | Enables AI analysis; an empty or missing key selects the fallback through the service. |
| `OPENAI_MODEL` | `gpt-5-mini` | Model used for structured analysis. |
| `OPENAI_TIMEOUT_MS` | `60000` | AI deadline in milliseconds; positive integer, at most `120000`. |

Next.js adds service credentials server-side, so its backend call is not authenticated by CORS. CORS configuration and service authentication serve different purposes.

The frontend's `BACKEND_TIMEOUT_MS` must exceed the AI deadline plus Redis and request-processing overhead. The default pair is 75 seconds for the frontend proxy and 60 seconds for AI.

## Analysis behaviour

### AI mode

The service sends the CV, job advert, target level, requested locale and optional answers to the OpenAI Responses API. A Zod-derived Structured Outputs schema constrains the response to at most 12 requirements, and the adapter checks the parsed structure and uniqueness of requirement IDs.

An answer can contribute only to the requirement with the same ID. If the model references another requirement's answer, that assessment becomes unknown and the unused answer remains visible in `unassessedClarifications`. This prevents an answer about one skill from silently earning credit for another.

The request currently uses an 8,000-token output allowance to accommodate the assessment and source excerpts, `store: false`, an explicit abort deadline and no automatic SDK retries. `gpt-5-mini` and its snapshot names use low reasoning effort. Each admitted analysis makes at most one provider request.

The prompt treats submitted text as untrusted data, requests only criteria explicitly present in the advert and distinguishes missing information from explicit non-fulfilment. It instructs the model to avoid inventing experience or inferring protected characteristics. Schema validation constrains structure; it does not establish the factual accuracy of an assessment.

### Fallback mode

If the provider cannot complete the assessment, returns an incomplete/invalid response, or has no configured key, the service returns `source: "heuristic"`. The frontend labels this as a basic review.

The fallback recognises predefined terms, mainly React, TypeScript, Next.js, APIs, testing, accessibility, performance, product collaboration, English, AI interest/experience and leadership. It also recognises some short practical-condition clauses. It cannot comprehensively interpret unrelated occupations, proficiency levels or complex context. Positive skill answers remain partial evidence in this mode.

When falling back after an AI clarification round, requirement IDs may differ. The fallback reuses an answer only if its label identifies one recognised skill and there is one matching answer. Combined or ambiguous labels and practical-condition answers are not reused as skill evidence; unmatched answers are disclosed for manual review. The ordinary word “next” is not treated as Next.js.

`NODE_ENV=test` uses local analysis. AI adapter tests mock the provider rather than sending real requests.

### Clarification and scoring policy

Each requirement has a CV assessability decision:

| `cvAssessability` | Behaviour |
| --- | --- |
| `yes` | Evaluate available CV evidence. Unknown evidence is normalised to a partial assessability decision. |
| `partially` | Ask when missing information is material; unresolved essential requirements receive priority. |
| `no` | Require candidate confirmation and keep the requirement unknown until it is supplied. |

The backend derives practical-condition handling from assessed requirements and recognised condition labels. A candidate's `kind` hint cannot by itself turn a skill into a condition or award credit for a blank skill answer.

The skills score is calculated deterministically after assessment:

```text
supportedWeight = sum(weight × statusFactor) for skills and experience
totalWeight     = sum(weight) for skills and experience
score           = round(100 × supportedWeight / totalWeight)

statusFactor: si = 1; parcial = 0.5; no = 0; unknown = 0
```

Practical conditions are excluded from scoring, skills gaps and suggested CV additions. The API returns `score: 0` when there are no skills requirements; the frontend presents no percentage and exports `null` in that case.

An omitted fact is not a confirmed gap. `gaps` contains explicit non-fulfilment of skills requirements. `cvImprovements` contains supported or partially supported self-reported skill information that could be added to the CV. `unassessedClarifications` lists submitted answers that could not be used, rather than silently treating them as evidence.

### Source traceability

Each requirement includes a `sources` object:

| Field | Content |
| --- | --- |
| `job` | One located job advert excerpt, or `null` when no excerpt can be selected. |
| `cv` | Up to two distinct CV excerpts; an empty array means no CV passage is linked. Practical conditions use an empty array. |
| `clarification` | The accepted answer's original `requirementId`, `response` and `details`, or `null`. |

An excerpt contains `text`, `start` and `end`. The indices are zero-based UTF-16 offsets into the trimmed request field, with an exclusive end: `input.slice(start, end) === text`. Excerpts contain at most 320 characters. Only whitespace differences are tolerated when locating model-proposed quotations; the returned text is always the original substring. Paraphrases, translations, changed numbers and inserted ellipses are rejected. Repeated passages resolve to their first matching occurrence.

The AI schema requests a job excerpt for every requirement and CV excerpts for CV-based evidence. If an AI source cannot be located, the existing local fallback is used; unsupported quotations are not exposed. The fallback selects bounded passages using its existing keyword vocabulary. Accepted candidate answers are copied from validated input, never generated by the model. Next.js and the browser independently compare every returned excerpt and answer against that request's input.

These checks establish where a quotation came from, not whether a candidate's statement is true or a model's interpretation is correct. This distinction matters because [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrain the response structure but can still contain mistakes. Quotes retain their source language even when the explanations use another locale.

## API reference

### Endpoints

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | None | Process status, timestamp and uptime. |
| `GET` | `/api/v1` | None | API name, version and readiness label. |
| `POST` | `/api/v1/analyses` | Service credentials | Initial analysis or clarification update. |

The health and version endpoints do not check downstream services.

### Analysis request

Normal visitors use the frontend's `/api/analyze` route. Direct backend calls require:

```http
Content-Type: application/json
Authorization: Bearer <INTERNAL_API_SECRET>
X-JobFit-Client: <64-character-lower-case-hexadecimal-identity>
```

| Field | Required | Validation |
| --- | --- | --- |
| `cvText` | Yes | String, 80–50,000 characters after trimming. |
| `jobText` | Yes | String, 80–50,000 characters after trimming. |
| `seniority` | Yes | `junior`, `mid` or `senior`. |
| `language` | No | `es` or `en`; defaults to `es`. |
| `clarifications` | No | Up to 12 answers with unique requirement IDs. |

Unknown fields are rejected. The route limits request bodies to 512 KiB. Authentication runs before body parsing, and schema validation runs before quota reservation.

Example input, using fictional application material:

```json
{
  "cvText": "Project Support Officer with four years coordinating programmes. I prepare monthly Excel reports using pivot tables, maintain action logs and communicate progress to stakeholders.",
  "jobText": "Project Support Officer required. Essential: experience preparing reports in Excel and willingness to travel to other offices when needed.",
  "seniority": "mid",
  "language": "en"
}
```

For a local diagnostic request, run this from `backend/` after configuring your own `.env`. It loads those values into the Bash session and makes an analysis request, which consumes application quota and may call OpenAI:

```bash
set -a
source .env
set +a

curl -sS http://127.0.0.1:4000/api/v1/analyses \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $INTERNAL_API_SECRET" \
  -H 'x-jobfit-client: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' \
  --data-binary @- <<'JSON'
{
  "cvText": "Project Support Officer with four years coordinating programmes. I prepare monthly Excel reports using pivot tables, maintain action logs and communicate progress to stakeholders.",
  "jobText": "Project Support Officer required. Essential: experience preparing reports in Excel and willingness to travel to other offices when needed.",
  "seniority": "mid",
  "language": "en"
}
JSON
```

The fixed client identity above is for local diagnostics. Browser requests receive a server-generated HMAC identity from Next.js.

### Clarification submission

Send the original input fields again with a `clarifications` array. Reuse the IDs and labels returned in the first report. The following is the additional field to include, not a standalone request:

```json
{
  "clarifications": [
    {
      "requirementId": "excel-reporting",
      "requirement": "Excel reporting",
      "kind": "evidence",
      "response": "yes",
      "details": "I prepare monthly reports using pivot tables and lookup formulas."
    },
    {
      "requirementId": "travel",
      "requirement": "Willingness to travel to other offices",
      "kind": "condition",
      "response": "yes",
      "details": ""
    }
  ]
}
```

| Answer field | Rule |
| --- | --- |
| `requirementId` | Trimmed string, 1–80 characters, unique within the array. |
| `requirement` | Trimmed string, 1–160 characters. |
| `kind` | Optional `evidence` or `condition`; omission uses evidence validation rules. |
| `response` | `yes`, `partly` or `no`. |
| `details` | Required string, at most 1,000 characters after trimming. May be empty for a negative answer or a positive condition answer. |

`partly` always requires details. A positive skill answer also requires a level or example. Answers are self-reported information and do not alter the CV text.

Providing `clarifications`, including an empty array, finishes the clarification round and returns no further questions. Posting it still reserves quota. The frontend's skip action instead uses the existing draft locally without posting again.

### Report response

The following illustrates the response shape; exact assessment content and weights depend on the supplied material and analysis mode:

```json
{
  "generatedAt": "2026-11-02T10:00:00.000Z",
  "language": "en",
  "seniority": "mid",
  "roleTitle": "Project Support Officer",
  "score": 100,
  "summary": "1 of 1 skills and experience requirements have sufficient support. 0 still need clarification.",
  "strengths": [
    "Excel reporting"
  ],
  "gaps": [],
  "requirements": [
    {
      "id": "excel-reporting",
      "label": "Excel reporting",
      "kind": "evidence",
      "category": "required",
      "categoryLabel": "required",
      "status": "si",
      "evidence": "The CV describes monthly Excel reports using pivot tables.",
      "evidenceSource": "cv",
      "weight": 10,
      "cvAssessability": "yes",
      "cvAssessmentReason": "The CV provides a specific reporting example.",
      "clarificationMaterial": false,
      "sources": {
        "job": {
          "text": "experience preparing reports in Excel",
          "start": 45,
          "end": 82
        },
        "cv": [
          {
            "text": "I prepare monthly Excel reports using pivot tables",
            "start": 65,
            "end": 115
          }
        ],
        "clarification": null
      }
    },
    {
      "id": "travel",
      "label": "Willingness to travel to other offices",
      "kind": "condition",
      "category": "required",
      "categoryLabel": "required",
      "status": "unknown",
      "evidence": "Your confirmation is needed; this cannot be determined from the CV alone.",
      "evidenceSource": "unknown",
      "weight": 1,
      "cvAssessability": "no",
      "cvAssessmentReason": "This condition needs your confirmation; the CV does not establish your availability.",
      "clarificationMaterial": true,
      "sources": {
        "job": {
          "text": "willingness to travel to other offices when needed",
          "start": 87,
          "end": 137
        },
        "cv": [],
        "clarification": null
      }
    }
  ],
  "source": "ai",
  "questions": [
    {
      "requirementId": "travel",
      "requirement": "Willingness to travel to other offices",
      "kind": "condition",
      "question": "Does this condition work for you?",
      "reason": "This condition needs your confirmation; the CV does not establish your availability."
    }
  ],
  "cvImprovements": [],
  "unassessedClarifications": []
}
```

The API uses stable status codes (`si`, `parcial`, `no`, `unknown`) and provenance values (`cv`, `user`, `unknown`) in both languages. Explanations follow the requested locale; quoted excerpts retain their original language. All report arrays, including `questions`, are present even when empty.

The response combines skills and conditions in `requirements`. The frontend's downloaded JSON separates these into `requirements` and `conditions` and localises status labels. The API response and downloaded format are therefore intentionally different.

### Error responses

| Status | Typical cause |
| --- | --- |
| `400` | Invalid input, malformed body or missing/invalid client identity. |
| `401` | Missing or incorrect service credentials. |
| `413` | Request body exceeds the configured limit. |
| `415` | Unsupported request content type. |
| `429` | Application rate, daily or concurrency limit reached. |
| `503` | Redis quota checks are unavailable. |
| `500` | Unexpected server failure. |

AI provider failures normally produce a successful, labelled heuristic report rather than a raw provider error. Next.js sanitises backend errors before exposing them to the browser and may map internal failures to `503 AnalysisUnavailable`.

## Shared quotas

One Redis Lua operation checks and reserves the per-client short window, per-client daily quota, global daily quota and concurrency slot atomically. All backend instances must use the same Redis database and limits.

- The short window begins with the first admitted request and lasts `ANALYSIS_WINDOW_SECONDS`.
- Daily counters expire at the next UTC midnight, using Redis server time.
- Each admitted request gets a unique concurrency reservation. The controller releases it after analysis.
- Abandoned reservations expire after `OPENAI_TIMEOUT_MS` plus 60 seconds; the default lease is two minutes.
- Invalid, unauthorised or quota-rejected requests do not consume a reservation.
- Admitted attempts remain charged if AI fails or the fallback runs. Releasing a slot does not refund request quota.
- Redis failures block analysis with `503`; there is no in-memory quota fallback.

Quota rejections return `Retry-After` and one of `RateLimitExceeded`, `DailyLimitExceeded`, `GlobalLimitExceeded` or `AnalysisBusy`.

The Compose configuration in [compose.redis.yml](../compose.redis.yml) enables append-only persistence, `appendfsync always` and `noeviction`, with a named data volume. Losing or deleting Redis data resets the corresponding counters. Rotating the service secret changes per-client identities but does not reset the global counter.

These are request limits, not monetary budgets. Provider spending settings are configured separately. Client identities are IP-derived, so shared networks may share limits; local development without a trusted IP header uses one shared identity.

## Security and privacy

The analysis route checks the shared service credential with a timing-safe comparison and validates the client identity before parsing the body. Zod validation rejects unknown fields, enforces text/answer limits and runs before any quota reservation or provider call.

CVs, adverts and answers are passed as untrusted data in the AI request. The backend checks output structure and applies report rules after model assessment. Prompt instructions reduce the risk of misinterpreting submitted instructions but do not guarantee correct model decisions.

Redis stores counters, hashed client identifiers and reservation IDs. It does not store CVs or reports. AI mode sends the supplied material to OpenAI with `store: false`; heuristic mode processes it locally. The application has no report database or candidate account system.

Public errors do not expose stack traces, parser messages or raw provider errors. Each request receives a server-generated UUID in `X-Request-Id`; client-supplied request IDs are ignored. Logs redact service credentials and client identity headers, suppress raw parser diagnostics, and categorise AI failures without logging the provider's raw error message. Unexpected server errors are logged for diagnosis. Analysis/error responses use `Cache-Control: no-store`.

For deployment, keep Redis private and configure authentication/TLS for remote access. Keep the API private where possible, configure the shared secret in both services, set the intended CORS origin and provide the frontend with a trusted ingress IP header. The frontend requires HTTPS for remote backend connections. Service authentication does not replace visitor accounts, ingress traffic controls or deployment monitoring.

## Testing

Install dependencies in both applications: backend tests import the frontend proxy and input validator.

From `backend/`:

```bash
npm run typecheck
npm run build
npm test
```

The normal suite uses local analysis, mocked provider calls and test quota stores. It does not call OpenAI. Coverage includes:

- Authentication, input validation and the public analysis contract.
- Frontend/backend agreement on accepted input and clarification limits.
- Same-origin proxy behaviour, bounded uploads/responses, IP normalisation and safe error forwarding.
- Missing versus negative evidence, candidate answers, conditions and score calculation.
- Complete clarification rounds through Next.js and Fastify in both languages.
- Runtime report validation, unambiguous answer matching and localised JSON export.
- Source text/offset checks, whitespace handling, fabricated citation rejection and original answer preservation.
- Incomplete AI output, timeouts and safe fallback reports.
- Public error sanitisation and request references.

### Redis integration tests

Use a dedicated test Redis instance or database. For a local Redis server with database 15 available:

```bash
REDIS_TEST_URL=redis://127.0.0.1:6379/15 npm test -- tests/analysis-quota.integration.test.ts
```

Without `REDIS_TEST_URL`, these tests are skipped. They use random namespaces and delete only their own keys. They exercise cross-instance limits, reconnects, concurrent reservations, daily expiry, window expiry and abandoned leases.

An unreachable test Redis commonly produces `Connection is closed` or `MaxRetriesPerRequestError`. Confirm connectivity to the same host, port and database before running the integration suite.

### Dependency maintenance

Run `npm audit` in this directory to review all dependencies, or `npm audit --omit=dev` for production dependencies. Include `package-lock.json` with dependency changes and rerun the relevant checks. The frontend has a separate dependency tree and audit.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `Invalid environment configuration` at startup | Start from `backend/`, create `.env`, and set a valid service secret and Redis URL. |
| `/health` succeeds but analysis returns `503` | Health is process-only; verify Redis connectivity and quota-store configuration. |
| Direct API request returns `401` | The shell credential must match the running backend's `INTERNAL_API_SECRET`. |
| Analysis consistently uses the heuristic fallback | Check the key, model, provider availability and deadline. AI failure logs include a controlled reason category. |
| Frontend reports unavailable after receiving an older report | Restart the backend; rebuild first if running compiled JavaScript. The frontend expects the current question and report fields. |
| A clarification submission returns `400` | Reuse returned IDs, respect the 12-answer limit and provide details where required. |
| Analysis ends at the proxy before the backend completes | Keep `BACKEND_TIMEOUT_MS` above `OPENAI_TIMEOUT_MS` plus processing overhead. |
| A valid request returns `429` | Respect the retry period; admitted failures and clarification submissions also count towards limits. |

Public deployment remains a separate project step. The supplied Compose file runs Redis only; it does not containerise or deploy either application.
