"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import type { ClarificationAnswer } from "@/lib/analysis-input";
import type { ClarificationQuestion } from "@/lib/analysis-report";

export type AnswerDrafts = Record<string, { response: ClarificationAnswer["response"] | ""; details: string }>;

export function ClarificationForm({ questions, answers, onChange, onSubmit, onSkip, busy }: {
  questions: ClarificationQuestion[];
  answers: AnswerDrafts;
  onChange: (answers: AnswerDrafts) => void;
  onSubmit: (answers: ClarificationAnswer[]) => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const { t } = useLanguage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <form className="space-y-5 p-4 sm:p-5" onSubmit={(event) => {
      event.preventDefault();
      const selected = questions.flatMap((question) => {
        const answer = answers[question.requirementId];
        return answer?.response ? [{ requirementId: question.requirementId, requirement: question.requirement,
          response: answer.response, details: answer.details.trim() }] : [];
      });
      if (selected.length) onSubmit(selected);
      else onSkip();
    }}>
      <div>
        <h3 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-slate-950">{t.clarification.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t.clarification.description}</p>
      </div>
      {questions.map((question, index) => {
        const answer = answers[question.requirementId] ?? { response: "", details: "" };
        const id = `clarification-${index}`;
        return (
          <fieldset key={question.requirementId} disabled={busy} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-950">{question.requirement}</legend>
            <p id={`${id}-question`} className="text-sm leading-6 text-slate-700">{question.question}</p>
            <label className="block text-sm font-medium" htmlFor={`${id}-response`}>{t.clarification.response}</label>
            <select id={`${id}-response`} aria-describedby={`${id}-question`} value={answer.response}
              onChange={(event) => onChange({ ...answers, [question.requirementId]: { ...answer, response: event.target.value as typeof answer.response } })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">{t.clarification.skipQuestion}</option>
              <option value="yes">{t.clarification.yes}</option>
              <option value="partly">{t.clarification.partly}</option>
              <option value="no">{t.clarification.no}</option>
            </select>
            {answer.response ? <>
              <label className="block text-sm font-medium" htmlFor={`${id}-details`}>{answer.response === "no" ? t.clarification.optionalDetails : t.clarification.details}</label>
              <textarea id={`${id}-details`} value={answer.details} maxLength={1000} required={answer.response !== "no"}
                onChange={(event) => onChange({ ...answers, [question.requirementId]: { ...answer, details: event.target.value } })}
                className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6"
                placeholder={t.clarification.placeholder} />
              <p className="text-xs text-slate-500">{answer.details.length}/1000</p>
            </> : null}
          </fieldset>
        );
      })}
      <p className="text-xs leading-5 text-slate-600">{t.clarification.disclosure}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="bg-slate-950 text-white">{busy ? t.actions.analyzing : t.clarification.finish}</Button>
        <Button type="button" variant="outline" onClick={onSkip} disabled={busy}>{t.clarification.skipAll}</Button>
      </div>
    </form>
  );
}
