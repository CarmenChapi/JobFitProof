# JobFitProof — Frontend

The JobFitProof frontend is a bilingual Next.js workbench for comparing a CV with a job advert, answering clarification questions and reviewing an evidence-based fit report. A server-side API route connects the browser to the Fastify backend without exposing service credentials.

[Project overview and full setup](../README.md) · [Backend and API contract](../backend/README.md)

## Responsibilities

- Collect and validate CV text, job advert text, report language and target level.
- Present a responsive **Compare → Clarify → Decide** workflow.
- Manage optional clarification answers and preserve them if a submission fails.
- Display skills evidence, practical conditions, uncertainty and suggested CV improvements.
- Export the final report as JSON.
- Validate and forward requests through a protected Next.js server route.
- Validate returned reports before forwarding them or updating the interface.

Requirement assessment, score calculation and quota enforcement belong to the backend. The frontend displays the returned assessment and translates interface labels.

## Technology

| Technology | Use |
| --- | --- |
| Next.js 16 App Router | Page rendering, application shell and server route |
| React 19 and TypeScript | Interactive state and typed data contracts |
| Tailwind CSS 4 | Layout, responsive styles and design tokens |
| Base UI and class-variance-authority | Shared button primitive and variants |
| Lucide | Interface icons |
| `ipaddr.js` and Node.js crypto | Server-side IP normalisation and pseudonymous client identities |

UI components are stored in the repository. The shadcn generator is not an installed application dependency.

## Local development

Use Node.js 22 or later. The backend and Redis must be running to perform an analysis; see the [root setup guide](../README.md#local-setup).

Run the following commands from `frontend/`:

```bash
npm ci
test -f .env.local || cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
BACKEND_API_URL=http://127.0.0.1:4000
INTERNAL_API_SECRET=<same-generated-secret-as-backend>
APP_ORIGIN=http://127.0.0.1:3000
TRUSTED_CLIENT_IP_HEADER=
BACKEND_TIMEOUT_MS=75000
```

Replace the secret placeholder with the same 64-character lower-case hexadecimal value used by the backend. The [root guide](../README.md#2-configure-the-environment) includes the generation command. `.env.local` is ignored by Git.

Start the development server:

```bash
npm run dev -- --webpack --hostname 127.0.0.1
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). To use the default Next.js bundler, run `npm run dev` instead.

The browser address must exactly match `APP_ORIGIN`. If the hostname or port changes, update the variable and restart the development server. `localhost` and `127.0.0.1` are different origins.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run dev -- --webpack --hostname 127.0.0.1` | Start development with Webpack on loopback. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Create a production build. |
| `npm run build -- --webpack` | Create a production build using Webpack. |
| `npm start` | Serve an existing production build. |

`npm start` runs in production mode. Analysis requests then require a trusted ingress IP header as well as `APP_ORIGIN`; use the development command for the local setup described above.

## Structure

```text
app/
├── layout.tsx                 Metadata, document shell and language provider
├── page.tsx                   Workbench page
├── globals.css                Theme, shared styles and motion preferences
└── api/analyze/route.ts        POST handler delegating to the server proxy
components/
├── jobfit-workbench.tsx        Input, request lifecycle and workflow state
├── analysis-report-view.tsx   Report presentation, conditions and evidence
├── requirement-sources.tsx    Accessible source disclosure for each requirement
├── clarification-form.tsx     Grouped questions, answer validation and progress
├── report-placeholder.tsx     Empty and loading states
├── language-provider.tsx      Language context and local preference persistence
└── ui/button.tsx              Shared Base UI button
lib/
├── analysis-input.ts          Runtime input validation for browser and proxy
├── analysis-report.ts         Report types and shared runtime response validation
├── report-export.ts           Localised JSON payload and download filename
├── i18n.ts                    British English and Castilian Spanish copy
├── utils.ts                   Class-name composition
└── server/
    ├── analysis-proxy.ts       Origin checks, bounded input and authenticated forwarding
    ├── upstream-errors.ts      Public error sanitisation and response headers
    └── upstream-report.ts      Bounded response reading and report validation
```

## Interface and state

### Input and analysis

The workbench starts with example text. Users can load the example again, clear the inputs or supply their own text. Each text must contain 80–50,000 characters after trimming. Target levels are `junior`, `mid` and `senior`.

Analyses are submitted to `/api/analyze`. The browser never calls OpenAI or the backend analysis endpoint directly. Input errors, usage limits and unavailable services produce localised messages while preserving the entered text.

Reports are checked at runtime before entering React state, including statuses, unique requirement IDs and question-to-requirement references. A partial or outdated backend contract produces a controlled error instead of a rendering failure. Report language and target level must match the submitted request.

An `AbortController` cancels an in-flight request when the input, language or target level changes. A request identity check prevents an older response from replacing newer state. Editing these inputs also clears the current draft, report and clarification answers. There are no automatic UI retries.

### Clarification round

When the first report contains questions, the interface shows a clarification form before the final report. Every question is optional, and the form supports up to 12 questions.

| Group | Responses | Additional detail |
| --- | --- | --- |
| Skills and experience | Yes, Partly, Not yet | A level or example is required for Yes and Partly. Details for Not yet are optional. |
| Practical conditions | Yes, No, Depends | Only Depends requires context. Selecting Yes or No removes previous conditional details. |

The form displays each requirement, a completion counter and, for skills questions, the question and its reason. Submitting selected answers makes a second analysis request. **Continue without answering** displays the existing draft without contacting the API again.

There is no second round of questions. If a clarification submission fails, the existing answers remain available for retry or skipping.

### Report and export

The report displays the skills score, assessed role, summary, requirement-level evidence, provenance, unresolved information and suggested next steps. Practical conditions appear in their own section and do not change the skills score. The score explanation makes the treatment of unknown requirements explicit.

Each skill and practical condition has a keyboard-accessible **View sources** disclosure. It shows the original job advert excerpt, up to two CV passages and the candidate's accepted clarification response and details. Missing CV evidence is explicitly distinguished from a confirmed gap. Unknown requirements also show the reason clarification is needed. Quotes keep the source language and are rendered as plain text, including any HTML-like content in the supplied documents.

The server proxy and browser both check the returned quote text and offsets against the submitted documents, and clarification sources against the submitted answers. An unverifiable response is rejected before rendering. A matched quote establishes its origin, not the truth of a claim or the accuracy of its interpretation.

The API returns a combined `requirements` array. The frontend separates it by `kind` for display and download:

| Export field | Content |
| --- | --- |
| `generatedAt`, `language`, `seniority`, `roleTitle` | Assessment context; `generatedAt` preserves the backend's assessment timestamp. |
| `score`, `scoreExplanation`, `source` | Skills score, explanation and `ai` or `heuristic` source. |
| `requirements` | Skills and experience, with localised status and provenance labels. |
| `conditions` | Practical conditions, with their own compatibility labels. |
| `summary`, `strengths`, `gaps` | Assessment summary and confirmed skills findings. |
| `cvImprovements`, `unassessedClarifications` | Suggested additions and answers that could not be assessed. |

Requirement exports retain CV assessability, its reason, materiality and the `sources` object. Source indices are UTF-16 offsets into the trimmed request fields, as described in the [backend source contract](../backend/README.md#source-traceability). If there are no skills requirements, the interface displays a dash and exports `score: null`. Exported status labels are localised text rather than the raw API status codes. The download does not attach the input documents; its excerpts and answers may contain personal information, and a short input can fit entirely inside an excerpt.

### Language and accessibility

The interface supports `es` and `en`, with Spanish as the initial default. User-facing copy is in [lib/i18n.ts](lib/i18n.ts). English uses British spelling; Spanish uses Castilian Spanish from Spain.

Only the language preference is persisted under `jobfitproof-language` in `localStorage`. User text, answers and reports remain in React state. Changing language translates untouched sample text but preserves user-written text and clears the analysis.

The interface includes labelled controls, keyboard focus indicators, a skip link, grouped questions, status announcements and focus management when questions or a final report appear. Animations respect `prefers-reduced-motion`. The layout adapts to mobile and desktop screens.

## Server proxy

The App Router handler delegates to [lib/server/analysis-proxy.ts](lib/server/analysis-proxy.ts). This module runs on the server and is the boundary between the public browser request and the authenticated backend request.

Before forwarding, the proxy:

1. Checks the server secret and configured application origin.
2. Requires a matching `Origin` and rejects explicitly cross-site requests.
3. Accepts only uncompressed UTF-8 `application/json`.
4. Reads at most 512 KiB, with a five-second upload deadline and `Content-Length` consistency checks.
5. Validates the input fields, including optional clarification answers, and forwards only normalised data.
6. Generates its own service authentication and client identity headers.
7. Sends the request to `/api/v1/analyses` with a deadline, no caching and redirects disabled.

Unknown input fields are rejected. The browser and proxy use the same input parser, while the backend independently validates its Zod schema. The [backend API documentation](../backend/README.md#api-reference) is the reference for field names and limits.

On success, the proxy reads at most **256 KiB** of UTF-8 report data under the same upstream deadline. It validates the complete report contract, rejects unexpected fields and checks the requested language and target level. Invalid, oversized or stalled responses become `503 AnalysisUnavailable`; their contents are not forwarded. Response validation is shared with the browser.

### Environment variables

All variables below are server-side configuration. None should use a `NEXT_PUBLIC_` prefix.

| Variable | Default | Requirement |
| --- | --- | --- |
| `INTERNAL_API_SECRET` | None | Required in every environment; must match the backend. |
| `BACKEND_API_URL` | `http://127.0.0.1:4000` | Backend origin only; no path, credentials, query or fragment. Remote connections require HTTPS. |
| `APP_ORIGIN` | Request URL origin in development | Set explicitly for local use; required in production. Must match the browser origin. |
| `TRUSTED_CLIENT_IP_HEADER` | Empty | Required in production; name of an ingress-owned header containing one verified IP address. |
| `BACKEND_TIMEOUT_MS` | `75000` | Integer from 1,000 to 180,000 milliseconds. Keep it above the backend AI deadline plus processing overhead. |

With no trusted header configured in development, all requests use one shared loopback quota identity. Visitor-supplied IP headers are ignored in that mode.

In production, the hosting ingress must overwrite the selected IP header, and clients must not be able to bypass that ingress. A comma-separated forwarding chain is not accepted. IPv4-mapped IPv6 addresses are normalised to IPv4; IPv6 addresses share an identity within a `/64`. The resulting address/network is HMAC-hashed with the service secret before forwarding. Shared networks can therefore share a quota.

The secret authenticates Next.js to the backend. It does not provide accounts or authenticate the visitor.

### Errors and response handling

| Response | Handling |
| --- | --- |
| `400`, `413`, `415` | Localised input guidance; entered text is preserved. |
| `408` | Upload timeout message. |
| `429` | Rate, daily or concurrency message using a recognised code and `Retry-After`. |
| Other failures | Controlled unavailable message; internal exception details are not displayed. |

Upstream error bodies are never forwarded verbatim. For quota errors, body inspection is capped at 4 KiB and one second. Only recognised codes and valid retry values are retained. A valid backend UUID in `X-Request-Id` is forwarded for log correlation. Analysis responses use `Cache-Control: no-store`.

## Verification and maintenance

From `frontend/`:

```bash
npm run lint
npm run build -- --webpack
```

From the repository root, run the tests that directly exercise frontend server behaviour, contract parity and JSON export:

```bash
npm --prefix backend test -- tests/frontend-proxy.test.ts tests/analysis-input.test.ts tests/frontend-report.test.ts
```

Both applications' dependencies must be installed. These tests use controlled upstream responses and Fastify injection, including a complete clarification round through both server handlers in English and Spanish. They cover malformed reports, response size/deadline limits, answer provenance, separate condition exports and preservation of the assessment timestamp. They do not call OpenAI or require Redis. The repository currently has no frontend `npm test` script or committed browser-test suite.

After interface changes, manually check both languages, mobile and desktop layouts, keyboard focus, input reset, clarification validation, loading/error states and JSON export. Use the backend test suite when changing the API contract.

Run `npm audit` from this directory to review dependency advisories. Dependency changes should include the lockfile. `package.json` contains two narrowly scoped development-tool overrides:

- The optional ESLint WASM resolver uses `@napi-rs/wasm-runtime` 1.1.6.
- `@typescript-eslint/typescript-estree` 8.65.0 uses `minimatch` 11.0.1 to address [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Other minimatch consumers keep their declared versions. The replacement preserves the CommonJS API used by the parser and supports the project's Node.js version.

Review these overrides when updating their parent packages; remove them once the upstream dependency ranges include a suitable fixed release. Recheck lint, builds and the audit after each change.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| The interface loads but analysis fails immediately | Check the backend, Redis and shared secret. Confirm the browser address matches `APP_ORIGIN`. |
| Local `npm start` renders the page but rejects analysis | Production mode requires trusted ingress configuration. Use `npm run dev` for the documented local workflow. |
| The report is labelled as a basic review | The backend used its limited heuristic fallback. Inspect the backend's AI configuration and logs. |
| A recently updated interface cannot read the report | Restart the backend to load the current contract; a healthy process may still be running older code. |
| A request finishes after the user edits the inputs | The stale response is ignored intentionally. Start another analysis with the updated text. |
| Inputs disappear after a full page reload | CV and report state is not persisted. Export a completed report before leaving the page. |

For quota behaviour, API schemas and backend errors, see the [backend README](../backend/README.md).
