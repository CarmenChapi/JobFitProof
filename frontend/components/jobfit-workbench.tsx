"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  CircleHelp,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { ClarificationForm, type AnswerDrafts } from "@/components/clarification-form";
import { ReportPlaceholder } from "@/components/report-placeholder";
import { parseAnalysisInput, type ClarificationAnswer } from "@/lib/analysis-input";
import type { Report, RequirementStatus } from "@/lib/analysis-report";
import { languages, translations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Seniority = "junior" | "mid" | "senior";

type AnalysisInput = {
  cvText: string;
  jobText: string;
  seniority: Seniority;
};

const seniorityLabels: Record<Seniority, string> = {
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
};

const statusStyles: Record<
  RequirementStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  si: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  parcial: {
    icon: TriangleAlert,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  no: {
    icon: XCircle,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  unknown: {
    icon: CircleHelp,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-2xl border border-border bg-[#f9faf7] p-3.5">
      <span className="mt-0.5 shrink-0 text-forest">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] leading-4 text-subtle">{label}</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-ink">{value}</p>
      </div>
    </div>
  );
}

export function JobFitWorkbench() {
  const { language, setLanguage, t } = useLanguage();
  const previousLanguageRef = useRef(language);
  const [cvText, setCvText] = useState(translations.es.samples.cv);
  const [jobText, setJobText] = useState(translations.es.samples.job);
  const [seniority, setSeniority] = useState<Seniority>("mid");
  const [analysisInput, setAnalysisInput] = useState<AnalysisInput>({
    cvText: translations.es.samples.cv,
    jobText: translations.es.samples.job,
    seniority: "mid",
  });
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
    setAnalysisInput((current) => ({
      ...current,
      cvText: current.cvText === previousCopy.samples.cv ? nextCopy.samples.cv : current.cvText,
      jobText: current.jobText === previousCopy.samples.job ? nextCopy.samples.job : current.jobText,
    }));
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
  const evidenceRequirements = report?.requirements.filter((requirement) => requirement.kind !== "condition") ?? [];
  const practicalConditions = report?.requirements.filter((requirement) => requirement.kind === "condition") ?? [];
  const activeStep = report ? 2 : draftReport ? 1 : 0;
  const gapText =
    report && report.gaps.length > 0 ? report.gaps.join(", ") : t.report.noCriticalGaps;

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

      const nextReport = (await response.json()) as Report;
      if (requestRef.current !== controller) return;
      setAnalysisInput({ cvText, jobText, seniority });
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
    setReport(null);
    setAnalysisError(null);
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
    setReport(null);
    setAnalysisError(null);
  }

  function handleExport() {
    if (!report) {
      return;
    }

    const filename = report.roleTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const exportRequirement = ({ label, kind, categoryLabel, status, evidence, evidenceSource, cvAssessability, cvAssessmentReason, clarificationMaterial }: Report["requirements"][number]) => ({
      label, kind, category: categoryLabel,
      status: kind === "condition" ? t.conditionStatus[status] : t.status[status],
      evidence, evidenceSource, evidenceSourceLabel: t.provenance[evidenceSource],
      cvAssessability, cvAssessmentReason, clarificationMaterial,
    });
    const payload = {
      generatedAt: new Date().toISOString(),
      language,
      seniority: seniorityLabels[analysisInput.seniority],
      score: evidenceRequirements.length ? report.score : null,
      scoreExplanation: t.report.scoreHelp,
      source: report.source,
      roleTitle: report.roleTitle,
      summary: report.summary,
      strengths: report.strengths,
      gaps: report.gaps,
      cvImprovements: report.cvImprovements,
      unassessedClarifications: report.unassessedClarifications,
      requirements: evidenceRequirements.map(exportRequirement),
      conditions: practicalConditions.map(exportRequirement),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `jobfitproof-${filename || t.report.filenameFallback}.json`;
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
            <div className="workspace-reveal p-5 sm:p-7">
              {report.source === "heuristic" ? <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t.report.fallback}</p> : null}
              {!evidenceRequirements.length ? <p className="mb-4 text-sm text-slate-600">{t.report.noRequirements}</p> : null}
              <div className="report-score rounded-2xl p-5 text-white sm:p-6">
                <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-lime">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />{t.workspace.complete}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-5">
                  <div className="relative flex size-28 shrink-0 items-center justify-center">
                    <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
                      <circle cx="56" cy="56" r="49" fill="none" stroke="currentColor" strokeWidth="5" className="text-white/15" />
                      <circle cx="56" cy="56" r="49" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - (evidenceRequirements.length ? report.score : 0)} className="text-lime" />
                    </svg>
                    <span className="text-4xl font-medium tracking-[-0.06em]">{evidenceRequirements.length ? report.score : "—"}</span>
                    {evidenceRequirements.length ? <span className="ml-0.5 mt-3 text-sm text-white/65">%</span> : null}
                  </div>
                  <div className="min-w-0 flex-1 basis-36">
                    <p className="text-[11px] text-white/70">{t.report.matchScore}</p>
                    <p className="mt-2 text-2xl font-medium leading-tight tracking-[-0.035em]">{report.roleTitle}</p>
                  </div>
                </div>
                <p className="mt-5 border-t border-white/15 pt-4 text-sm leading-6 text-white/85">{report.summary}</p>
              </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Metric
                      icon={BarChart3}
                      label={t.report.requirementsMetric}
                      value={t.report.requirementsValue(evidenceRequirements.length)}
                    />
                    <Metric
                      icon={CheckCircle2}
                      label={t.report.strengthsMetric}
                      value={t.report.strengthsValue(report.strengths.length)}
                    />
                    <Metric icon={BriefcaseBusiness} label={t.report.gapsMetric} value={gapText} />
                  </div>

              <p className="mt-3 text-xs leading-5 text-slate-600">{t.report.scoreHelp}</p>
              {report.unassessedClarifications?.length ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {t.report.unassessed} {report.unassessedClarifications.join(", ")}
              </p> : null}

              {practicalConditions.length ? <section aria-label={t.report.conditionsTitle} className="mt-6 rounded-2xl border border-border bg-paper/60 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><BriefcaseBusiness className="size-4 text-forest" aria-hidden="true" />{t.report.conditionsTitle}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{t.report.conditionsHelp}</p>
                <ul className="mt-3 divide-y divide-slate-200">
                  {practicalConditions.map((condition) => <li key={condition.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-950">{condition.label}</p>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusStyles[condition.status].className)}>{t.conditionStatus[condition.status]}</span>
                    </div>
                    <p className="text-xs uppercase text-slate-500">{condition.categoryLabel}</p>
                    <p className="text-sm leading-6 text-slate-600">{condition.evidence}</p>
                    <p className="text-xs text-forest">{t.provenance[condition.evidenceSource]}</p>
                  </li>)}
                </ul>
              </section> : null}

              <div className="mt-6 overflow-hidden rounded-2xl border border-border">
                <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-paper/70 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{t.report.evidenceTitle}</p>
                  <p className="hidden text-sm font-semibold text-slate-500 sm:block">
                    {t.report.statusTitle}
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {evidenceRequirements.map((requirement) => {
                    const status = statusStyles[requirement.status];
                    const Icon = status.icon;

                    return (
                      <div
                        className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-start"
                        key={requirement.id}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-950">{requirement.label}</p>
                            <span className="rounded-md bg-paper px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-subtle">
                              {requirement.categoryLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {requirement.evidence}
                          </p>
                          <p className="mt-2 text-xs font-medium text-forest">{t.provenance[requirement.evidenceSource]}</p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium",
                            status.className,
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {t.status[requirement.status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {(["unknown", "parcial"] as const).map((status) => {
                const items = evidenceRequirements.filter((requirement) => requirement.status === status);
                return items.length ? <div key={status} className="mt-5 rounded-2xl border border-border p-4">
                  <h3 className="text-sm font-semibold">{status === "unknown" ? t.report.pending : t.report.partial}</h3>
                  <p className="mt-1 text-sm text-slate-600">{items.map((requirement) => requirement.label).join(", ")}</p>
                  {status === "unknown" ? <p className="mt-2 text-xs leading-5 text-slate-500">{t.report.unknownHelp}</p> : null}
                </div> : null;
              })}
              {report.cvImprovements.length ? <div className="mt-5 rounded-2xl border border-[#dce7cb] bg-[#f0f5e8] p-5">
                <h3 className="text-sm font-semibold text-forest">{t.report.addToCv}</h3>
                <p className="mt-1 text-sm leading-6 text-forest">{t.report.addToCvHelp}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-forest">{report.cvImprovements.map((label) => <li key={label}>{label}</li>)}</ul>
              </div> : null}

              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-paper p-5">
                <ArrowUpRight className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-ink">{t.report.nextTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-subtle">
                    {report.gaps.length > 0 ? t.report.improve(report.gaps[0]) : t.report.ready}
                  </p>
                </div>
              </div>
            </div>
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
