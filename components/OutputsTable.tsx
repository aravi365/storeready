"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, Loader2, Rows3, Trash2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/Segmented";
import { cn } from "@/lib/utils";
import { scaleFactor } from "@/utils/detect";
import { planFit } from "@/utils/canvasResizer";
import type { Asset, Job, OutputState } from "@/utils/jobs";

const fmt = (n?: number) => (n === undefined ? "—" : n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`);

type Filter = "all" | "app_store" | "play_store";

export function OutputsTable({
  jobs,
  assets,
  outputFor,
  onPreview,
  onRemove,
}: {
  jobs: Job[];
  assets: Asset[];
  outputFor: (job: Job) => OutputState | undefined;
  onPreview: (jobId: string) => void;
  onRemove: (job: Job) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const rows = jobs.filter((j) => filter === "all" || j.preset.store === filter);
  const done = jobs.filter((j) => outputFor(j)?.status === "done");
  const bytes = done.reduce((n, j) => n + (outputFor(j)?.bytes ?? 0), 0);
  const compliant = done.filter((j) => outputFor(j)?.compliance?.ok).length;

  if (!jobs.length) return null;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Rows3 className="size-4" /> Outputs
          </h2>
          <p className="text-xs text-muted-foreground">
            {done.length}/{jobs.length} rendered · {fmt(bytes)} · {compliant}/{done.length || 0} compliant
          </p>
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "app_store", label: "App Store" },
            { value: "play_store", label: "Google Play" },
          ]}
        />
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted/80 text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-2 py-2 font-medium">Source</th>
              <th className="px-2 py-2 font-medium">Size</th>
              <th className="px-2 py-2 font-medium">Scale</th>
              <th className="px-2 py-2 font-medium">Weight</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => {
              const out = outputFor(j);
              const a = assetMap.get(j.assetId);
              const snapped =
                !!a && j.opts.mode === "fit" && planFit(a.width, a.height, j.size.w, j.size.h, j.opts.padding).strategy !== "letterbox";
              const f = a ? scaleFactor({ w: a.width, h: a.height }, j.size, snapped ? "fill" : j.opts.mode) : 1;
              const path = out?.path ?? `${j.pathStem}.${j.enc.format === "png" ? "png" : "jpg"}`;
              const folder = path.split("/").slice(1, -1).join("/");
              return (
                <tr key={j.id} className="border-t hover:bg-muted/40">
                  <td className="max-w-[280px] px-4 py-2">
                    <button
                      type="button"
                      onClick={() => onPreview(j.id)}
                      className="block max-w-full truncate text-left font-mono font-medium hover:text-primary hover:underline"
                      title={`Preview ${path}`}
                    >
                      {path.split("/").pop()}
                    </button>
                    <div className="truncate font-mono text-xs text-muted-foreground">{folder}/</div>
                  </td>
                  <td className="max-w-[140px] truncate px-2 py-2 text-muted-foreground" title={a?.name}>
                    {a?.name}
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums">
                    {j.size.w}×{j.size.h}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2 font-mono tabular-nums",
                      f > 1.25 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                    )}
                  >
                    {f > 1.005 ? "↑" : f < 0.995 ? "↓" : "="}
                    {f.toFixed(2)}×
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums text-muted-foreground">{fmt(out?.bytes)}</td>
                  <td className="px-2 py-2">
                    {!out ? (
                      <span className="text-muted-foreground">Queued</span>
                    ) : out.status === "rendering" ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Rendering
                      </span>
                    ) : out.status === "error" ? (
                      <span className="inline-flex items-center gap-1 text-destructive" title={out.error}>
                        <XCircle className="size-3" /> Failed
                      </span>
                    ) : out.compliance?.ok ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> Compliant
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-destructive"
                        title={out.compliance?.checks.filter((c) => !c.ok).map((c) => c.label).join("\n")}
                      >
                        <XCircle className="size-3" /> Not compliant
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onPreview(j.id)}
                      className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted"
                      aria-label={`Preview ${path.split("/").pop()}`}
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(j)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${path.split("/").pop()} from the export`}
                      title="Remove this output for this image"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    {out?.url && (
                      <a
                        href={out.url}
                        download={out.fileName}
                        className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted"
                        aria-label={`Download ${out.fileName}`}
                      >
                        <Download className="size-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
