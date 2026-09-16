# JobFitProof

JobFitProof is a frontend prototype for checking how well a resume fits a job post before applying.

The current version is a local Next.js workbench where a user can paste a resume, paste a job description, choose a target seniority, switch the interface between Spanish and English, generate a fit report, and export the result as JSON.

## Current Features

- Resume and job-post text inputs.
- Target seniority selector.
- Spanish/English language context with local preference persistence.
- Local heuristic analysis for match score, strengths, gaps, and evidence by requirement.
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

- Paste resume text.
- Paste job-post text.
- Choose report language.
- Choose target seniority.
- Run analysis.
- Review score, evidence, strengths, and gaps.
- Export the report.

The next practical step is to move the analysis behind an internal API route:

```txt
app/api/analyze/route.ts
```

At first, that route can return the same local heuristic result. Later, it can be swapped for an AI-backed analysis without rewriting the frontend workflow.

## Notes

The current scoring is intentionally simple and local. It is useful for validating the product flow, not for final hiring or career advice.
