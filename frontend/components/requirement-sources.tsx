"use client";

import { useLanguage } from "@/components/language-provider";
import type { Report, SourceQuote } from "@/lib/analysis-report";

function Quote({ quote }: { quote: SourceQuote }) {
  return (
    <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-forest/25 pl-3 text-sm leading-6 text-ink [overflow-wrap:anywhere]">
      {quote.text}
    </blockquote>
  );
}

export function RequirementSources({ requirement }: { requirement: Report["requirements"][number] }) {
  const { t } = useLanguage();
  const { sources } = requirement;
  const answer = sources.clarification;
  const responseLabel = answer?.response === "yes" ? t.clarification.yes
    : answer?.response === "no" ? t.clarification.conditionNo
    : requirement.kind === "condition" ? t.clarification.depends : t.clarification.partly;

  return (
    <details className="mt-3 min-w-0 rounded-xl border border-border bg-paper/50 p-3">
      <summary className="cursor-pointer rounded text-xs font-semibold text-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
        {t.sources.show}<span className="sr-only">: {requirement.label}</span>
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs leading-5 text-subtle">{t.sources.description}</p>
        <div>
          <p className="text-xs font-semibold text-forest">{t.sources.job}</p>
          {sources.job ? <Quote quote={sources.job} /> : (
            <p className="mt-2 text-xs leading-5 text-subtle">{t.sources.noJobQuote}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-forest">{t.sources.cv}</p>
          {sources.cv.length ? sources.cv.map((quote) => (
            <Quote key={`${quote.start}-${quote.end}`} quote={quote} />
          )) : (
            <p className="mt-2 text-xs leading-5 text-subtle">
              {requirement.kind === "condition" ? t.sources.conditionNeedsAnswer : t.sources.noCvQuote}
            </p>
          )}
        </div>
        {answer ? (
          <div>
            <p className="text-xs font-semibold text-forest">{t.sources.answer}</p>
            <p className="mt-2 text-sm font-medium text-ink">{t.sources.response}: {responseLabel}</p>
            {answer.details ? (
              <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-forest/25 pl-3 text-sm leading-6 text-ink [overflow-wrap:anywhere]">
                {answer.details}
              </blockquote>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-subtle">{t.sources.selfReported}</p>
          </div>
        ) : null}
        {requirement.status === "unknown" ? (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-forest">{t.sources.pending}</p>
            <p className="mt-2 text-xs leading-5 text-subtle">{requirement.cvAssessmentReason}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}
