"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReadinessItem, ReadinessReport } from "@/utils/readiness";

const ICON = {
  error: <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />,
  warning: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />,
  info: <Info className="mt-0.5 size-4 shrink-0 text-sky-500" />,
};

const GROUP_LABEL: Record<ReadinessItem["store"], string> = {
  app_store: "Apple App Store",
  play_store: "Google Play",
  files: "Files",
};

export function ReadinessPanel({
  report,
  onEnablePreset,
}: {
  report: ReadinessReport;
  onEnablePreset: (presetId: string) => void;
}) {
  if (!report.checked.length) return null;
  const groups = (["app_store", "play_store", "files"] as const)
    .map((g) => ({ g, items: report.items.filter((i) => i.store === g) }))
    .filter((x) => x.items.length);

  const headline = report.errors
    ? `${report.errors} issue${report.errors === 1 ? "" : "s"} to fix before upload`
    : report.warnings
      ? `Ready, with ${report.warnings} warning${report.warnings === 1 ? "" : "s"}`
      : "Ready to upload";

  return (
    <Card aria-labelledby="readiness-title">
      <CardHeader>
        <CardTitle id="readiness-title" className="flex items-center gap-2">
          <ClipboardCheck className="size-4" /> Store readiness
        </CardTitle>
        <CardDescription
          className={cn(
            "flex items-center gap-1.5 font-medium",
            report.errors ? "text-destructive" : report.warnings ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {report.errors ? <XCircle className="size-4" /> : report.warnings ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
          {headline}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Every language meets the screenshot count, required size and feature graphic rules for {report.checked.length === 1 ? "its store" : "both stores"}.
          </p>
        )}
        {groups.map(({ g, items }) => (
          <section key={g} className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{GROUP_LABEL[g]}</h3>
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex gap-2 text-sm" data-level={i.level}>
                  {ICON[i.level]}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{i.title}</p>
                    {i.detail && <p className="text-xs text-muted-foreground">{i.detail}</p>}
                    {i.fixPreset && (
                      <Button variant="outline" size="xs" className="mt-1.5" onClick={() => onEnablePreset(i.fixPreset!)}>
                        Enable this size
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-xs text-muted-foreground">Checked: {report.checked.map((c) => c.replace("_store", "").replace("/", " · ")).join(", ")}</p>
      </CardContent>
    </Card>
  );
}
