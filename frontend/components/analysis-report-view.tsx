"use client";

import { ArrowUpRight, BarChart3, BriefcaseBusiness, CheckCircle2, CircleHelp, TriangleAlert, XCircle } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { RequirementSources } from "@/components/requirement-sources";
import type { Report, RequirementStatus } from "@/lib/analysis-report";
import { cn } from "@/lib/utils";

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

export function AnalysisReportView({ report }: { report: Report }) {
  const { t } = useLanguage();
  const evidenceRequirements = report.requirements.filter((requirement) => requirement.kind === "evidence");
  const practicalConditions = report.requirements.filter((requirement) => requirement.kind === "condition");
  const gapText = report.gaps.length ? report.gaps.join(", ") : t.report.noCriticalGaps;

  return (
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
      {report.unassessedClarifications.length ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
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
            <RequirementSources requirement={condition} />
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
                  <RequirementSources requirement={requirement} />
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
  );
}
