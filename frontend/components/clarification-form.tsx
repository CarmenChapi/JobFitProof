"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, BriefcaseBusiness, FileCheck2, MessageCircle, RefreshCcw } from "lucide-react";
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
    <form className="workspace-reveal space-y-7 p-5 sm:p-7" onSubmit={(event) => {
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
      <div className="rounded-2xl border border-[#dce7cb] bg-[#f0f5e8] p-5">
        <MessageCircle className="mb-3 size-5 text-forest" strokeWidth={1.7} aria-hidden="true" />
        <h3 ref={headingRef} tabIndex={-1} className="scroll-mt-6 text-2xl font-semibold leading-tight tracking-[-0.035em] text-ink">{t.clarification.title}</h3>
        <p className="mt-3 text-sm leading-6 text-subtle">{t.clarification.description}</p>
        <div className="mt-5 border-t border-forest/10 pt-4">
          <p className="text-xs font-medium text-forest" role="status">{t.clarification.progress(answeredCount, questions.length)}</p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-forest/10" aria-hidden="true">
            <div className="h-full rounded-full bg-forest transition-[width] duration-300" style={{ width: `${questions.length ? answeredCount / questions.length * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      {(["condition", "evidence"] as const).map((kind) => {
        const group = questions.filter((question) => (question.kind ?? "evidence") === kind);
        if (!group.length) return null;
        return <section key={kind} aria-label={kind === "condition" ? t.clarification.conditionsTitle : t.clarification.evidenceTitle} className="space-y-4">
          <div className="mb-5">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
              {kind === "condition" ? <BriefcaseBusiness className="size-4 text-forest" aria-hidden="true" /> : <FileCheck2 className="size-4 text-forest" aria-hidden="true" />}
              {kind === "condition" ? t.clarification.conditionsTitle : t.clarification.evidenceTitle}
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-paper font-mono text-[10px] text-subtle">{group.length}</span>
            </h4>
            <p className="mt-2 text-xs leading-5 text-subtle">{kind === "condition" ? t.clarification.conditionsHelp : t.clarification.evidenceHelp}</p>
          </div>
          {group.map((question) => {
        const index = questions.indexOf(question);
        const condition = kind === "condition";
        const answer = answers[question.requirementId] ?? { response: "", details: "" };
        const id = `clarification-${index}`;
        return (
          <fieldset key={question.requirementId} disabled={busy} className="min-w-0 space-y-3 rounded-2xl border border-border px-4 pb-4 pt-3 disabled:opacity-60">
            <legend className="max-w-full px-1.5 text-sm font-semibold leading-6 text-ink">{question.requirement}</legend>
            {!condition ? <>
              <p id={`${id}-question`} className="text-sm leading-6 text-slate-700">{question.question}</p>
              <p className="text-xs leading-5 text-subtle">{question.reason}</p>
            </> : null}
            <label className="block text-xs font-medium text-subtle" htmlFor={`${id}-response`}>{condition ? t.clarification.conditionResponse : t.clarification.response}</label>
            <select id={`${id}-response`} aria-describedby={condition ? undefined : `${id}-question`} value={answer.response}
              onChange={(event) => onChange({ ...answers, [question.requirementId]: {
                response: event.target.value as typeof answer.response,
                details: condition && event.target.value !== "partly" ? "" : answer.details,
              } })}
              className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-[#f9faf7] px-3 py-2 text-sm text-ink transition-colors focus:border-forest/50 focus:bg-white">
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
                className="workspace-input min-h-28"
                placeholder={condition ? t.clarification.dependsPlaceholder : t.clarification.placeholder} />
              <p className="text-right font-mono text-[10px] text-subtle">{answer.details.length}/1000</p>
            </> : null}
          </fieldset>
        );
          })}
        </section>;
      })}
      <div className="space-y-4 border-t border-border pt-5">
        <p className="text-xs leading-5 text-subtle">{t.clarification.disclosure}</p>
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={busy} className="h-12 justify-between rounded-xl bg-forest px-4 text-white hover:bg-[#1c4232]">
            {busy ? t.actions.analyzing : t.clarification.finish}
            {busy ? <RefreshCcw className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4 text-lime" aria-hidden="true" />}
          </Button>
          <Button type="button" variant="ghost" onClick={onSkip} disabled={busy} className="h-11 rounded-xl text-xs text-subtle hover:bg-paper">{t.clarification.skipAll}</Button>
        </div>
      </div>
    </form>
  );
}
