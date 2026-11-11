"use client";

import { useLanguage } from "@/components/language-provider";
import type { Report } from "@/lib/analysis-report";

export function AnalysisCoverage({ report }: { report: Report }) {
  const { t } = useLanguage();
  if (report.coverage.hasMoreRequirements !== true) return null;
  return (
    <aside aria-label={t.coverage.title} className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:mx-7">
      <h3 className="text-sm font-semibold">{t.coverage.title}</h3>
      <p className="mt-2 text-sm leading-6">{t.coverage.description}</p>
      {report.coverage.additionalRequirements.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold">{t.coverage.examples}</summary>
          <ul className="mt-3 space-y-3">
            {report.coverage.additionalRequirements.map(({ label, source }, index) => (
              <li key={`${label}-${index}`}>
                <p className="text-xs font-semibold">{label}</p>
                <blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-amber-300 pl-3 text-xs leading-5 [overflow-wrap:anywhere]">{source.text}</blockquote>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </aside>
  );
}
