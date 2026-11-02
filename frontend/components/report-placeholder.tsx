"use client";

import { ArrowUpRight, BriefcaseBusiness, Check, CircleHelp, FileCheck2, FileText, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

export function ReportPlaceholder({ loading }: { loading: boolean }) {
  const { t } = useLanguage();
  const features = [
    { icon: FileCheck2, title: t.workspace.emptyEvidence, description: t.workspace.emptyEvidenceHelp },
    { icon: CircleHelp, title: t.workspace.emptyContext, description: t.workspace.emptyContextHelp },
    { icon: ArrowUpRight, title: t.workspace.emptyNext, description: t.workspace.emptyNextHelp },
  ];

  return (
    <div className="flex flex-1 flex-col px-5 pb-7 pt-8 sm:px-7">
      <div className="workspace-reveal flex flex-1 flex-col items-center justify-center py-7 text-center">
        <div className="document-art mb-8" aria-hidden="true">
          <div className="document-sheet">
            <FileText className="mb-2 size-6 text-forest" strokeWidth={1.5} />
            <span className="document-line w-10" />
            <span className="document-line" />
            <span className="document-line" />
            <span className="document-line w-12" />
          </div>
          <div className="document-sheet">
            <BriefcaseBusiness className="mb-2 size-6 text-forest" strokeWidth={1.5} />
            <span className="document-line w-10" />
            <span className="document-line" />
            <span className="document-line" />
            <span className="document-line w-12" />
          </div>
          <div className="document-seal">
            {loading ? <LoaderCircle className="size-6 animate-spin" /> : <Check className="size-6" />}
          </div>
        </div>
        <div role={loading ? "status" : undefined} className="max-w-sm">
          <h3 className="text-balance text-[26px] font-semibold leading-tight tracking-[-0.035em] text-ink">
            {loading ? t.workspace.loadingTitle : t.workspace.emptyTitle}
          </h3>
          <p className="mt-3 text-pretty text-sm leading-6 text-subtle">
            {loading ? t.workspace.loadingDescription : t.workspace.emptyDescription}
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-5 border-t border-border pt-6 sm:grid-cols-3 sm:gap-4">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex items-start gap-3 sm:block">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper text-forest">
              <Icon className="size-4" strokeWidth={1.7} aria-hidden="true" />
            </span>
            <div className="sm:mt-3">
              <p className="text-xs font-semibold text-ink">{title}</p>
              <p className="mt-1 text-xs leading-5 text-subtle">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
