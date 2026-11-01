"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  CircleHelp,
  Languages,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { ClarificationForm, type AnswerDrafts } from "@/components/clarification-form";
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
    <div className="flex min-w-0 items-center gap-3 border-b border-slate-200 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:last:border-r-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-teal-50 text-teal-700">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-950">{value}</p>
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
    const payload = {
      generatedAt: new Date().toISOString(),
      language,
      seniority: seniorityLabels[analysisInput.seniority],
      score: report.score,
      scoreExplanation: t.report.scoreHelp,
      source: report.source,
      roleTitle: report.roleTitle,
      summary: report.summary,
      strengths: report.strengths,
      gaps: report.gaps,
      cvImprovements: report.cvImprovements,
      unassessedClarifications: report.unassessedClarifications,
      requirements: report.requirements.map(({ label, categoryLabel, status, evidence, evidenceSource }) => ({
        label,
        category: categoryLabel,
        status: t.status[status],
        evidence,
        evidenceSource,
        evidenceSourceLabel: t.provenance[evidenceSource],
      })),
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
    <main className="min-h-screen bg-[#f5f0e8] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/10 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-slate-950 text-white shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight text-slate-950">JobFitProof</p>
              <p className="truncate text-sm text-slate-600">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div
              className="flex h-9 flex-1 items-center gap-1 rounded-[8px] border border-slate-300 bg-white p-1 text-slate-700 sm:flex-none"
              aria-label={t.language.label}
            >
              <Languages className="ml-1 size-4 shrink-0 text-slate-500" aria-hidden="true" />
              {languages.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={cn(
                    "h-7 min-w-8 rounded-[6px] px-2 text-xs font-semibold transition",
                    language === option.code
                      ? "bg-teal-700 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                  aria-pressed={language === option.code}
                  aria-label={`${t.language.switchTo} ${t.language[option.code]}`}
                  onClick={() => setLanguage(option.code)}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
            <Button
              className="h-9 flex-1 rounded-[8px] border-slate-300 bg-white text-slate-800 hover:bg-slate-100 sm:flex-none"
              variant="outline"
              onClick={handleLoadSample}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {t.actions.sample}
            </Button>
            <Button
              className="h-9 flex-1 rounded-[8px] border-slate-300 bg-white text-slate-800 hover:bg-slate-100 sm:flex-none"
              variant="outline"
              onClick={handleReset}
              aria-label={t.actions.resetInputs}
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              {t.actions.clear}
            </Button>
            <Button
              className="h-9 flex-1 rounded-[8px] bg-slate-950 text-white hover:bg-slate-800 sm:flex-none"
              onClick={() => void handleAnalyze()}
              disabled={!canAnalyze || isAnalyzing}
            >
              {isAnalyzing ? (
                <RefreshCcw className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              {isAnalyzing ? t.actions.analyzing : t.actions.analyze}
            </Button>
          </div>
        </header>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(320px,0.92fr)_minmax(460px,1.08fr)]">
          <section className="min-w-0 border border-slate-900/10 bg-white/80 shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                  <h1 className="truncate text-base font-semibold text-slate-950">
                    {t.form.title}
                  </h1>
                </div>
                <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                  {t.form.badge}
                </span>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-slate-900" htmlFor="cv-text">
                    {t.form.cvLabel}
                  </label>
                  <span className="text-xs text-slate-500">{t.form.wordCount(formStats.cvWords)}</span>
                </div>
                <textarea
                  id="cv-text"
                  className="min-h-48 w-full resize-y rounded-[8px] border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15"
                  value={cvText}
                  onChange={(event) => { invalidateAnalysis(); setCvText(event.target.value); }}
                  placeholder={t.form.cvPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-slate-900" htmlFor="job-text">
                    {t.form.jobLabel}
                  </label>
                  <span className="text-xs text-slate-500">{t.form.wordCount(formStats.jobWords)}</span>
                </div>
                <textarea
                  id="job-text"
                  className="min-h-44 w-full resize-y rounded-[8px] border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15"
                  value={jobText}
                  onChange={(event) => { invalidateAnalysis(); setJobText(event.target.value); }}
                  placeholder={t.form.jobPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">{t.form.seniority}</p>
                <div className="grid grid-cols-3 overflow-hidden rounded-[8px] border border-slate-300 bg-white">
                  {(Object.keys(seniorityLabels) as Seniority[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={cn(
                        "h-10 border-r border-slate-300 text-sm font-medium text-slate-600 transition last:border-r-0 hover:bg-slate-50",
                        seniority === option && "bg-teal-700 text-white hover:bg-teal-700",
                      )}
                      onClick={() => { invalidateAnalysis(); setSeniority(option); }}
                    >
                      {seniorityLabels[option]}
                    </button>
                  ))}
                </div>
              </div>

              {!canAnalyze ? (
                <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {t.form.minWarning}
                </div>
              ) : null}
            </div>
          </section>

          <section aria-busy={isAnalyzing} className="min-w-0 border border-slate-900/10 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ClipboardList className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                  <h2 className="truncate text-base font-semibold text-slate-950">
                    {t.report.title}
                  </h2>
                </div>
                <Button
                  className="h-8 rounded-[8px] border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={!report}
                >
                  <Download className="size-4" aria-hidden="true" />
                  {t.actions.export}
                </Button>
              </div>
            </div>

            {analysisError ? (
              <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:px-5">
                {analysisError}
              </div>
            ) : null}

            {draftReport ? (
              <ClarificationForm questions={draftReport.questions} answers={answers} onChange={setAnswers}
                onSubmit={(selected) => void handleAnalyze(selected)} onSkip={handleSkipQuestions} busy={isAnalyzing} />
            ) : report ? (
            <div className="p-4 sm:p-5">
              {report.source === "heuristic" ? <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t.report.fallback}</p> : null}
              {!report.requirements.length ? <p className="mb-4 text-sm text-slate-600">{t.report.noRequirements}</p> : null}
              <div className="grid gap-5 xl:grid-cols-[220px_1fr]">
                <div className="flex flex-col justify-between gap-5 border border-slate-200 bg-[#111827] p-5 text-white">
                  <div>
                    <p className="text-xs font-medium uppercase text-white/55">
                      {t.report.matchScore}
                    </p>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-6xl font-semibold tracking-tight">{report.requirements.length ? report.score : "—"}</span>
                      {report.requirements.length ? <span className="pb-2 text-xl font-semibold text-white/45">%</span> : null}
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-[8px] bg-white/15">
                    <div
                      className="h-full rounded-[8px] bg-teal-400"
                      style={{ width: `${report.score}%` }}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-teal-700">
                    {report.roleTitle}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {report.summary}
                  </p>
                  <div className="mt-5 grid border-y border-slate-200 sm:grid-cols-3">
                    <Metric
                      icon={BarChart3}
                      label={t.report.requirementsMetric}
                      value={t.report.requirementsValue(report.requirements.length)}
                    />
                    <Metric
                      icon={CheckCircle2}
                      label={t.report.strengthsMetric}
                      value={t.report.strengthsValue(report.strengths.length)}
                    />
                    <Metric icon={BriefcaseBusiness} label={t.report.gapsMetric} value={gapText} />
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-600">{t.report.scoreHelp}</p>
              {report.unassessedClarifications?.length ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {t.report.unassessed} {report.unassessedClarifications.join(", ")}
              </p> : null}

              <div className="mt-6 overflow-hidden border border-slate-200">
                <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{t.report.evidenceTitle}</p>
                  <p className="hidden text-sm font-semibold text-slate-500 sm:block">
                    {t.report.statusTitle}
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {report.requirements.map((requirement) => {
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
                            <span className="rounded-[8px] border border-slate-200 px-2 py-0.5 text-xs font-medium uppercase text-slate-500">
                              {requirement.categoryLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {requirement.evidence}
                          </p>
                          <p className="mt-2 text-xs font-medium text-teal-700">{t.provenance[requirement.evidenceSource]}</p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border px-2.5 text-sm font-medium",
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
                const items = report.requirements.filter((requirement) => requirement.status === status);
                return items.length ? <div key={status} className="mt-5 rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold">{status === "unknown" ? t.report.pending : t.report.partial}</h3>
                  <p className="mt-1 text-sm text-slate-600">{items.map((requirement) => requirement.label).join(", ")}</p>
                  {status === "unknown" ? <p className="mt-2 text-xs leading-5 text-slate-500">{t.report.unknownHelp}</p> : null}
                </div> : null;
              })}
              {report.cvImprovements.length ? <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
                <h3 className="text-sm font-semibold text-teal-950">{t.report.addToCv}</h3>
                <p className="mt-1 text-sm text-teal-900">{t.report.addToCvHelp}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-teal-900">{report.cvImprovements.map((label) => <li key={label}>{label}</li>)}</ul>
              </div> : null}

              <div className="mt-5 border border-teal-200 bg-teal-50 px-4 py-3">
                <p className="text-sm font-semibold text-teal-950">{t.report.nextTitle}</p>
                <p className="mt-1 text-sm leading-6 text-teal-900">
                  {report.gaps.length > 0 ? t.report.improve(report.gaps[0]) : t.report.ready}
                </p>
              </div>
            </div>
            ) : (
              <div className="flex min-h-96 items-center justify-center p-8 text-center text-sm text-slate-500">
                {isAnalyzing ? t.actions.analyzing : t.report.title}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
