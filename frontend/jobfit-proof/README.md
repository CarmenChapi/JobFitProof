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

## Notes

The current backend scoring is intentionally simple. It is useful for validating the product flow, not for final hiring or career advice.
