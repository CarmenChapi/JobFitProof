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
  const answeredCount = questions.filter((question) => {
    const answer = answers[question.requirementId];
    return answer?.response && (answer.response === "no" ||
      (question.kind === "condition" && answer.response === "yes") || answer.details.trim());
  }).length;
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <form className="space-y-5 p-4 sm:p-5" onSubmit={(event) => {
      event.preventDefault();
      const selected = questions.flatMap((question) => {
        const answer = answers[question.requirementId];
        return answer?.response ? [{ requirementId: question.requirementId, requirement: question.requirement,
          kind: question.kind, response: answer.response,
          details: question.kind === "condition" && answer.response !== "partly" ? "" : answer.details.trim() }] : [];
      });
      if (selected.length) onSubmit(selected);
      else onSkip();
    }}>
      <div>
        <h3 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-slate-950">{t.clarification.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t.clarification.description}</p>
        <p className="mt-2 text-sm font-medium text-teal-700" role="status">{t.clarification.progress(answeredCount, questions.length)}</p>
      </div>
      {(["condition", "evidence"] as const).map((kind) => {
        const group = questions.filter((question) => (question.kind ?? "evidence") === kind);
        if (!group.length) return null;
        return <section key={kind} aria-label={kind === "condition" ? t.clarification.conditionsTitle : t.clarification.evidenceTitle} className="space-y-3">
          <div>
            <h4 className="font-semibold text-slate-950">{kind === "condition" ? t.clarification.conditionsTitle : t.clarification.evidenceTitle}</h4>
            <p className="mt-1 text-sm text-slate-600">{kind === "condition" ? t.clarification.conditionsHelp : t.clarification.evidenceHelp}</p>
          </div>
          {group.map((question) => {
        const index = questions.indexOf(question);
        const condition = kind === "condition";
        const answer = answers[question.requirementId] ?? { response: "", details: "" };
        const id = `clarification-${index}`;
        return (
          <fieldset key={question.requirementId} disabled={busy} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-950">{question.requirement}</legend>
            {!condition ? <>
              <p id={`${id}-question`} className="text-sm leading-6 text-slate-700">{question.question}</p>
              <p className="text-xs leading-5 text-slate-500">{question.reason}</p>
            </> : null}
            <label className="block text-sm font-medium" htmlFor={`${id}-response`}>{condition ? t.clarification.conditionResponse : t.clarification.response}</label>
            <select id={`${id}-response`} aria-describedby={condition ? undefined : `${id}-question`} value={answer.response}
              onChange={(event) => onChange({ ...answers, [question.requirementId]: {
                response: event.target.value as typeof answer.response,
                details: condition && event.target.value !== "partly" ? "" : answer.details,
              } })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">{t.clarification.skipQuestion}</option>
              <option value="yes">{t.clarification.yes}</option>
              {condition ? <>
                <option value="no">{t.clarification.conditionNo}</option>
                <option value="partly">{t.clarification.depends}</option>
              </> : <>
                <option value="partly">{t.clarification.partly}</option>
                <option value="no">{t.clarification.no}</option>
              </>}
            </select>
            {answer.response && (!condition || answer.response === "partly") ? <>
              <label className="block text-sm font-medium" htmlFor={`${id}-details`}>{condition ? t.clarification.dependsDetails : answer.response === "no" ? t.clarification.optionalDetails : t.clarification.details}</label>
              <textarea id={`${id}-details`} value={answer.details} maxLength={1000} required={answer.response !== "no"}
                onChange={(event) => onChange({ ...answers, [question.requirementId]: { ...answer, details: event.target.value } })}
                className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6"
                placeholder={condition ? t.clarification.dependsPlaceholder : t.clarification.placeholder} />
              <p className="text-xs text-slate-500">{answer.details.length}/1000</p>
            </> : null}
          </fieldset>
        );
          })}
        </section>;
      })}
      <p className="text-xs leading-5 text-slate-600">{t.clarification.disclosure}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="bg-slate-950 text-white">{busy ? t.actions.analyzing : t.clarification.finish}</Button>
        <Button type="button" variant="outline" onClick={onSkip} disabled={busy}>{t.clarification.skipAll}</Button>
      </div>
    </form>
  );
}
