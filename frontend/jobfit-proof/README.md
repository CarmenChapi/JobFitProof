# JobFitProof

JobFitProof is a frontend prototype for checking how well a CV fits a job advert before applying.

The current version is a Next.js workbench connected to the JobFit Proof API. A user can paste a CV, paste a job advert, choose a target level, switch the interface between Castilian Spanish and British English, generate a fit report, and export the result as JSON.

## Current Features

- CV and job advert text inputs.
- Target level selector.
- Spanish/English language context with local preference persistence.
- Backend analysis for match score, strengths, gaps, and evidence by requirement.
- Report export as JSON.
- Responsive UI built with Next.js, React, Tailwind CSS, shadcn-style primitives, and lucide icons.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/base UI primitives
- lucide-react

## Getting Started

Install dependencies:

```bash
npm install
```

Copy the environment file and start the backend on port 4000:

```bash
cp .env.example .env.local
```

Set `INTERNAL_API_SECRET` to the same generated secret as the backend and start
Redis as described in the backend README. The secret must contain 64 lower-case
hexadecimal characters. Keep it server-only and never prefix it with `NEXT_PUBLIC_`.

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://127.0.0.1:3000
```

If Turbopack hangs during local development in this environment, use Webpack:

```bash
npm run dev -- --webpack --hostname 127.0.0.1
```

## Quality Checks

Run lint:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

## Project Structure

```txt
app/
  layout.tsx              Global app shell and language provider
  page.tsx                Home route
components/
  jobfit-workbench.tsx    Main interactive prototype
  language-provider.tsx   Language context and persistence
  ui/                     Shared UI primitives
lib/
  i18n.ts                 Spanish/English copy dictionaries
  utils.ts                Shared utility helpers
```

## MVP Direction

The agreed MVP flow is:

- Paste CV text.
- Paste the job advert.
- Choose report language.
- Choose the target level.
- Run analysis.
- Review score, evidence, strengths, and gaps.
- Export the report.

The frontend sends analyses through an internal API route:

```txt
app/api/analyze/route.ts
```

That route proxies requests to `BACKEND_API_URL`, which defaults to `http://127.0.0.1:4000`.
It adds service credentials and a client identifier on the server, replaces any
visitor-supplied internal headers, and forwards quota responses and `Retry-After`.
Remote backend connections require HTTPS; redirects are rejected.

## Protected Analysis Configuration

| Variable | Purpose |
| --- | --- |
| `INTERNAL_API_SECRET` | Shared server-only secret; required in every environment |
| `BACKEND_API_URL` | Backend origin, without a path or embedded credentials |
| `APP_ORIGIN` | Exact public frontend origin; required in production |
| `TRUSTED_CLIENT_IP_HEADER` | Ingress-owned header containing one verified client IP; required in production |
| `BACKEND_TIMEOUT_MS` | Upstream deadline in milliseconds; defaults to 40000 |

Only configure `TRUSTED_CLIENT_IP_HEADER` after verifying that your hosting provider
or reverse proxy **overwrites** this header and that visitors cannot bypass that
proxy. It must contain a single IP address. Arbitrary `X-Forwarded-For` chains are
rejected. The correct header depends on the eventual hosting setup; no provider is
assumed. Missing production configuration blocks analysis with `503`.

In local development, leaving the trusted header blank gives all visitors one
shared loopback quota identity and ignores IP headers supplied by the visitor.
Leaving `APP_ORIGIN` blank in development uses the request URL's origin. Browser
POST requests must still carry a matching `Origin` and `application/json` content type.

IPv4-mapped IPv6 addresses share the corresponding IPv4 quota. IPv6 addresses in
the same /64 share one quota. The normalised address is HMAC-hashed before it leaves
Next.js. Users on a shared network may share a quota.

The proxy caps request bodies at 512 KiB during streaming and limits body reading
to five seconds. Responses are marked `no-store`. Quota errors preserve entered
text and show a localised message; no automatic retries are made by the interface.

## Notes

The backend uses AI analysis with a heuristic fallback. Request quotas are enforced
before either mode runs. They are independent of the OpenAI spending limit configured
by the project owner. The reports remain a prototype, not final hiring or career advice.
