"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { ClarificationForm, type AnswerDrafts } from "@/components/clarification-form";
import { AnalysisReportView } from "@/components/analysis-report-view";
import { ReportPlaceholder } from "@/components/report-placeholder";
import { parseAnalysisInput, type ClarificationAnswer } from "@/lib/analysis-input";
import { parseAnalysisReport, type Report } from "@/lib/analysis-report";
import { languages, translations } from "@/lib/i18n";
import { buildReportExport } from "@/lib/report-export";
import { cn } from "@/lib/utils";

type Seniority = "junior" | "mid" | "senior";

const seniorityLabels: Record<Seniority, string> = {
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
};

export function JobFitWorkbench() {
  const { language, setLanguage, t } = useLanguage();
  const previousLanguageRef = useRef(language);
  const [cvText, setCvText] = useState(translations.es.samples.cv);
  const [jobText, setJobText] = useState(translations.es.samples.job);
  const [seniority, setSeniority] = useState<Seniority>("mid");
  const [report, setReport] = useState<Report | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [draftReport, setDraftReport] = useState<Report | null>(null);
  const [answers, setAnswers] = useState<AnswerDrafts>({});
  const requestRef = useRef<AbortController | null>(null);
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);

  const invalidateAnalysis = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setIsAnalyzing(false);
    setReport(null);
    setDraftReport(null);
    setAnswers({});
    setAnalysisError(null);
  }, []);

  useEffect(() => () => { requestRef.current?.abort(); }, []);
  useEffect(() => { if (report) reportHeadingRef.current?.focus(); }, [report]);

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;

    if (previousLanguage === language) {
      return;
    }

    const previousCopy = translations[previousLanguage];
    const nextCopy = translations[language];

    setCvText((current) => (current === previousCopy.samples.cv ? nextCopy.samples.cv : current));
    setJobText((current) =>
      current === previousCopy.samples.job ? nextCopy.samples.job : current,
    );
    invalidateAnalysis();
    previousLanguageRef.current = language;
  }, [language, invalidateAnalysis]);

  const formStats = useMemo(
    () => ({
      cvWords: cvText.trim().split(/\s+/).filter(Boolean).length,
      jobWords: jobText.trim().split(/\s+/).filter(Boolean).length,
    }),
    [cvText, jobText],
  );

  const canAnalyze = parseAnalysisInput({ cvText, jobText, seniority, language }) !== null;
  const activeStep = report ? 2 : draftReport ? 1 : 0;

  async function handleAnalyze(clarifications?: ClarificationAnswer[]) {
    const input = parseAnalysisInput({ cvText, jobText, seniority, language, ...(clarifications ? { clarifications } : {}) });
    if (!input) {
      setAnalysisError(t.form.invalidInput);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (!clarifications) {
      setReport(null);
      setDraftReport(null);
      setAnswers({});
    }
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (requestRef.current !== controller) return;

      if (response.status === 429) {
        const details = await response.json().catch(() => ({}));
        if (requestRef.current !== controller) return;
        const retryAfter = Number(response.headers.get("retry-after"));
        setAnalysisError(
          details.error === "AnalysisBusy"
            ? t.form.analysisBusy
            : ["DailyLimitExceeded", "GlobalLimitExceeded"].includes(details.error)
              ? t.form.dailyLimit
              : t.form.rateLimit(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60),
        );
        return;
      }

      if ([400, 413, 415].includes(response.status)) {
        setAnalysisError(t.form.invalidInput);
        return;
      }

      if (response.status === 408) {
        setAnalysisError(t.form.uploadTimeout);
        return;
      }

      if (!response.ok) {
        throw new Error(`Analysis request failed with status ${response.status}`);
      }

      const nextReport = parseAnalysisReport(await response.json(), input);
      if (requestRef.current !== controller) return;
      if (!nextReport || nextReport.language !== input.language || nextReport.seniority !== input.seniority) {
        throw new Error("Invalid analysis report");
      }
      if (!clarifications && nextReport.questions.length) {
        setDraftReport(nextReport);
      } else {
        setReport(nextReport);
        setDraftReport(null);
      }
    } catch {
      if (requestRef.current === controller) setAnalysisError(t.form.analysisError);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsAnalyzing(false);
      }
    }
  }

  function handleSkipQuestions() {
    if (!draftReport || isAnalyzing) return;
    setReport({ ...draftReport, questions: [] });
    setDraftReport(null);
    setAnswers({});
    setAnalysisError(null);
  }

  function handleReset() {
    invalidateAnalysis();
    setCvText("");
    setJobText("");
    setSeniority("mid");
  }

  function handleLoadSample() {
    invalidateAnalysis();
    const nextAnalysisInput = {
      cvText: t.samples.cv,
      jobText: t.samples.job,
      seniority: "mid" as const,
    };

    setCvText(nextAnalysisInput.cvText);
    setJobText(nextAnalysisInput.jobText);
    setSeniority(nextAnalysisInput.seniority);
  }

  function handleExport() {
    if (!report) {
      return;
    }

    const { filename, payload } = buildReportExport(report);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <a href="#application-material" className="sr-only z-50 rounded-lg bg-forest px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        {t.workspace.skipToWorkspace}
      </a>
      <div className="border-b border-border bg-white/75">
        <header className="mx-auto flex min-h-20 max-w-[1320px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest text-lime">
              <ShieldCheck className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold tracking-[-0.045em]">JobFit<span className="text-forest">Proof</span><span className="text-forest">.</span></p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <p className="hidden text-xs text-subtle md:block">{t.appSubtitle}</p>
            <div
              role="group"
              className="flex items-center gap-1 rounded-full border border-border bg-paper p-1"
              aria-label={t.language.label}
            >
              {languages.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={cn(
                    "h-8 min-w-9 rounded-full px-2.5 text-xs font-semibold transition-colors",
                    language === option.code
                      ? "bg-forest text-white shadow-sm"
                      : "text-subtle hover:bg-white",
                  )}
                  aria-pressed={language === option.code}
                  aria-label={`${t.language.switchTo} ${t.language[option.code]}`}
                  onClick={() => setLanguage(option.code)}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </header>
      </div>
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-10">
        <div className="workspace-reveal grid items-end gap-7 py-9 sm:py-12 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
          <div>
            <p className="eyebrow mb-4 flex items-center gap-2.5"><span className="size-1.5 rounded-full bg-forest" aria-hidden="true" />{t.workspace.label}</p>
            <h1 className="text-[38px] font-semibold leading-[1.1] tracking-[-0.055em] sm:text-5xl xl:text-[54px]">
              {t.workspace.title}<br /><span className="text-forest">{t.workspace.titleAccent}</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-subtle">{t.workspace.description}</p>
          </div>
          <ol aria-label={t.workspace.stepsLabel} className="grid grid-cols-3 gap-3 pb-1 sm:gap-6 lg:mb-1">
            {t.workspace.steps.map((step, index) => (
              <li key={step} aria-current={index === activeStep ? "step" : undefined}
                className={cn("border-t-2 pt-4 transition-colors", index <= activeStep ? "border-forest" : "border-[#dce2da]")}>
                <span className={cn("mb-3 flex size-7 items-center justify-center rounded-full font-mono text-[11px]", index === activeStep ? "bg-forest text-white" : index < activeStep ? "bg-[#e2ebd8] text-forest" : "bg-[#e9ede5] text-subtle")}>
                  {index < activeStep ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : `0${index + 1}`}
                </span>
                <p className={cn("text-sm font-semibold", index <= activeStep ? "text-ink" : "text-subtle")}>{step}</p>
                <p className="mt-1 text-[11px] text-subtle">{t.workspace.stepDescriptions[index]}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section id="application-material" tabIndex={-1} aria-labelledby="input-heading" className="workspace-panel scroll-mt-6">
            <div className="panel-heading">
              <div className="flex items-center gap-3">
                <span className="section-icon"><FileText className="size-[18px]" aria-hidden="true" /></span>
                <div>
                  <h2 id="input-heading" className="text-base font-semibold tracking-tight">{t.form.title}</h2>
                  <p className="mt-0.5 text-xs text-subtle">{t.workspace.inputHelp}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={handleLoadSample} className="h-9 -ml-2 rounded-lg px-2 text-xs text-forest hover:bg-paper">
                  <Sparkles className="size-3.5" aria-hidden="true" />{t.actions.sample}<ArrowUpRight className="size-3" aria-hidden="true" />
                </Button>
                <Button variant="ghost" onClick={handleReset} aria-label={t.actions.resetInputs} className="h-9 -mr-2 rounded-lg px-2 text-xs text-subtle hover:bg-paper">
                  <RefreshCcw className="size-3.5" aria-hidden="true" />{t.actions.clear}
                </Button>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="cv-text">
                    <span className="font-mono text-[10px] text-subtle" aria-hidden="true">01</span>
                    {t.form.cvLabel}
                  </label>
                  <span className="font-mono text-[10px] text-subtle">{t.form.wordCount(formStats.cvWords)}</span>
                </div>
                <textarea
                  id="cv-text"
                  className="workspace-input min-h-40"
                  value={cvText}
                  onChange={(event) => { invalidateAnalysis(); setCvText(event.target.value); }}
                  placeholder={t.form.cvPlaceholder}
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="job-text">
                    <span className="font-mono text-[10px] text-subtle" aria-hidden="true">02</span>
                    {t.form.jobLabel}
                  </label>
                  <span className="font-mono text-[10px] text-subtle">{t.form.wordCount(formStats.jobWords)}</span>
                </div>
                <textarea
                  id="job-text"
                  className="workspace-input min-h-40"
                  value={jobText}
                  onChange={(event) => { invalidateAnalysis(); setJobText(event.target.value); }}
                  placeholder={t.form.jobPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <p id="seniority-label" className="text-xs font-medium text-subtle">{t.form.seniority}</p>
                <div role="group" aria-labelledby="seniority-label" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-paper p-1">
                  {(Object.keys(seniorityLabels) as Seniority[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={cn(
                        "h-9 rounded-lg text-xs font-medium text-subtle transition-colors hover:bg-white/70",
                        seniority === option && "bg-white text-forest shadow-sm ring-1 ring-black/5 hover:bg-white",
                      )}
                      aria-pressed={seniority === option}
                      onClick={() => { invalidateAnalysis(); setSeniority(option); }}
                    >
                      {seniorityLabels[option]}
                    </button>
                  ))}
                </div>
              </div>

              {!canAnalyze ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {t.form.minWarning}
                </div>
              ) : null}
              <div className="border-t border-border pt-5">
                <Button className="h-12 w-full justify-between rounded-xl bg-forest px-5 text-sm font-medium text-white shadow-sm hover:bg-[#1c4232]" onClick={() => void handleAnalyze()} disabled={!canAnalyze || isAnalyzing}>
                  {isAnalyzing ? t.actions.analyzing : t.actions.analyze}
                  {isAnalyzing ? <RefreshCcw className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4 text-lime" aria-hidden="true" />}
                </Button>
                <p className="mt-3 text-center text-[11px] leading-5 text-subtle">{t.workspace.analysisHint}</p>
              </div>
            </div>
          </section>

          <section aria-busy={isAnalyzing} aria-labelledby="report-heading" className={cn("workspace-panel flex flex-col", !report && !draftReport && "self-stretch")}>
            <div className="panel-heading">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="section-icon"><ClipboardList className="size-[18px]" aria-hidden="true" /></span>
                  <div>
                    <h2 ref={reportHeadingRef} tabIndex={-1} id="report-heading" className="scroll-mt-6 text-base font-semibold tracking-tight">
                      {t.report.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-subtle">{t.workspace.reportHelp}</p>
                  </div>
                </div>
                {report ? (
                <Button
                  className="h-9 rounded-full border-border bg-white px-3 text-xs text-forest hover:bg-paper"
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                >
                  <Download className="size-4" aria-hidden="true" />
                  {t.actions.export}
                </Button>
                ) : <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1.5 text-[10px] font-medium text-subtle"><span className={cn("size-1.5 rounded-full", draftReport ? "bg-forest" : "bg-subtle/50")} aria-hidden="true" />{isAnalyzing ? t.actions.analyzing : draftReport ? t.workspace.clarifying : t.workspace.waiting}</span>}
            </div>

            {analysisError ? (
              <div role="alert" className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 sm:mx-7">
                {analysisError}
              </div>
            ) : null}

            {draftReport ? (
              <ClarificationForm questions={draftReport.questions} answers={answers} onChange={setAnswers}
                onSubmit={(selected) => void handleAnalyze(selected)} onSkip={handleSkipQuestions} busy={isAnalyzing} />
            ) : report ? (
              <AnalysisReportView report={report} />
            ) : (
              <ReportPlaceholder loading={isAnalyzing} />
            )}
          </section>
        </div>
        <footer className="flex flex-col justify-between gap-2 py-7 text-[11px] leading-5 text-subtle sm:flex-row">
          <p className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-forest" aria-hidden="true" />{t.workspace.footer}</p>
          <p>{t.workspace.footerNote}</p>
        </footer>
      </div>
    </main>
  );
}
