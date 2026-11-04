"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileArchive, Folder, FolderOpen, Loader2, Square, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ImageUploader } from "@/components/ImageUploader";
import { OutputsTable } from "@/components/OutputsTable";
import { OutputLightbox, type LightboxItem } from "@/components/OutputLightbox";
import { PresetSelector } from "@/components/PresetSelector";
import {
  DEFAULT_SETTINGS,
  buildJobs,
  excludePreset,
  jobSig,
  type Asset,
  type GlobalSettings,
  type Job,
  type OutputState,
} from "@/utils/jobs";
import { evaluate } from "@/utils/presets";
import { pngHasAlpha } from "@/utils/pngEncoder";
import { runJobs } from "@/utils/renderClient";
import { exportZip, type ZipEntry } from "@/utils/zipExporter";

type Phase = "idle" | "rendering" | "zipping" | "done" | "error";

interface RunState {
  phase: Phase;
  /** auto = background auto-generate; export = user pressed Download ZIP */
  kind: "auto" | "export";
  done: number;
  total: number;
  failed: number;
  zipPercent: number;
  current?: string;
  message?: string;
}

const IDLE: RunState = { phase: "idle", kind: "auto", done: 0, total: 0, failed: 0, zipPercent: 0 };

export function ScreenshotStudio() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [outputs, setOutputs] = useState<Record<string, OutputState>>({});
  const [run, setRun] = useState<RunState>(IDLE);
  const outputsRef = useRef(outputs);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef<Promise<void> | null>(null);
  const assetsRef = useRef(assets);
  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  const exporting = run.kind === "export" && (run.phase === "rendering" || run.phase === "zipping");
  const jobs = useMemo(() => buildJobs(assets, settings), [assets, settings]);
  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const patchOutputs = useCallback((patch: Record<string, OutputState>) => {
    for (const [id, v] of Object.entries(patch)) {
      const old = outputsRef.current[id];
      if (old?.url && old.url !== v.url) URL.revokeObjectURL(old.url);
    }
    outputsRef.current = { ...outputsRef.current, ...patch };
    setOutputs(outputsRef.current);
  }, []);

  const validOutput = useCallback((job: Job, map = outputsRef.current) => {
    const out = map[job.id];
    return out && out.sig === jobSig(job) ? out : undefined;
  }, []);

  useEffect(
    () => () => {
      Object.values(outputsRef.current).forEach((o) => o.url && URL.revokeObjectURL(o.url));
      assetsRef.current.forEach((a) => {
        URL.revokeObjectURL(a.thumbUrl);
        a.preview?.close();
      });
    },
    [],
  );

  useEffect(() => {
    if (!exporting) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [exporting]);

  // ───────── Render pipeline (shared by auto-generate and export) ─────────
  const render = useCallback(
    async (list: Job[], kind: RunState["kind"], signal: AbortSignal) => {
      const sigs = new Map(list.map((j) => [j.id, jobSig(j)]));
      let done = 0;
      let failed = 0;
      patchOutputs(Object.fromEntries(list.map((j) => [j.id, { sig: sigs.get(j.id)!, status: "rendering" as const }])));
      setRun({ ...IDLE, phase: "rendering", kind, total: list.length });

      try {
      await runJobs(assetsRef.current, list, {
        signal,
        onJob: async (job, outcome) => {
          done++;
          const sig = sigs.get(job.id)!;
          if (!outcome.ok) {
            failed++;
            patchOutputs({ [job.id]: { sig, status: "error", error: outcome.error } });
          } else {
            const { blob, format, width, height, note } = outcome.result;
            const path = `${job.pathStem}.${format === "png" ? "png" : "jpg"}`;
            // Self-verify what was actually encoded, not what was intended.
            const hasAlpha = format === "png" ? await pngHasAlpha(blob) : false;
            const compliance = evaluate(job.preset, { w: width, h: height }, { hasAlpha, format, bytes: blob.size });
            patchOutputs({
              [job.id]: {
                sig,
                status: "done",
                blob,
                bytes: blob.size,
                format,
                width,
                height,
                note,
                compliance,
                path,
                fileName: path.split("/").pop(),
                url: URL.createObjectURL(blob),
              },
            });
          }
          setRun((s) => ({ ...s, done, failed, current: job.pathStem.split("/").slice(1, 4).join(" / ") }));
        },
      });
      } finally {
        // Drop placeholders for jobs that never finished (cancelled), so they get re-queued.
        const next = { ...outputsRef.current };
        let changed = false;
        for (const j of list) {
          const o = next[j.id];
          if (o?.status === "rendering" && o.sig === sigs.get(j.id)) {
            delete next[j.id];
            changed = true;
          }
        }
        if (changed) {
          outputsRef.current = next;
          setOutputs(next);
        }
      }
      return { failed };
    },
    [patchOutputs],
  );

  const cancelRun = useCallback(async () => {
    abortRef.current?.abort();
    await runningRef.current?.catch(() => {});
  }, []);

  // ───────── Auto-generate: debounce, then render whatever is missing/stale ─────────
  useEffect(() => {
    if (!settings.autoGenerate || exporting) return;
    const missing = jobs.filter((j) => !validOutput(j));
    if (!missing.length) return;
    const t = setTimeout(async () => {
      await cancelRun();
      const todo = jobsRef.current.filter((j) => !validOutput(j));
      if (!todo.length) return;
      const ac = new AbortController();
      abortRef.current = ac;
      const p = render(todo, "auto", ac.signal)
        .then(() => setRun((s) => ({ ...s, phase: "idle" })))
        .catch((err) => {
          if ((err as Error).name !== "AbortError") toast.error("Auto-generate failed", { description: (err as Error).message });
        });
      runningRef.current = p;
    }, 700);
    return () => clearTimeout(t);
  }, [jobs, settings.autoGenerate, exporting, render, validOutput, cancelRun]);

  // ───────── Export ZIP (reuses already-rendered outputs) ─────────
  const startExport = useCallback(async () => {
    if (!jobs.length) {
      toast.error("Nothing to export", { description: "Add images and enable at least one matching preset and locale." });
      return;
    }
    if (!/^#[0-9a-f]{6}$/i.test(settings.matte)) {
      toast.error("Invalid background colour", { description: "Use a 6-digit hex value like #FFFFFF." });
      return;
    }
    await cancelRun();
    const ac = new AbortController();
    abortRef.current = ac;
    const snapshot = jobs;
    try {
      const missing = snapshot.filter((j) => validOutput(j)?.status !== "done");
      const p = missing.length ? render(missing, "export", ac.signal) : Promise.resolve({ failed: 0 });
      runningRef.current = p.then(() => {});
      await p;

      const entries: ZipEntry[] = [];
      for (const j of snapshot) {
        const o = validOutput(j);
        if (o?.status !== "done" || !o.blob) continue;
        entries.push({
          path: o.path!,
          blob: o.blob,
          width: o.width!,
          height: o.height!,
          store: j.preset.store,
          locale: j.locale,
          preset: j.preset.id,
          source: assetsRef.current.find((a) => a.id === j.assetId)?.name ?? "",
          compliance: o.compliance!,
          note: o.note,
        });
      }
      if (!entries.length) throw new Error("Every render failed. See the errors on each preview.");
      const failed = snapshot.length - entries.length;

      setRun((s) => ({ ...s, kind: "export", phase: "zipping", done: snapshot.length, total: snapshot.length, failed }));
      entries.sort((a, b) => a.path.localeCompare(b.path));
      const { bytes, fileName } = await exportZip(entries, (pr) =>
        setRun((s) => ({ ...s, zipPercent: pr.phase === "compressing" ? pr.percent : 0 })),
      );
      const compliant = entries.filter((e) => e.compliance.ok).length;
      setRun((s) => ({
        ...s,
        phase: "done",
        zipPercent: 100,
        message: `${fileName} · ${(bytes / 1048576).toFixed(1)} MB · ${compliant}/${entries.length} compliant`,
      }));
      toast.success("ZIP ready", { description: `${entries.length} files${failed ? `, ${failed} failed` : ""}. Download started.` });
    } catch (err) {
      const aborted = (err as Error).name === "AbortError";
      setRun((s) => ({ ...s, phase: aborted ? "idle" : "error", message: (err as Error).message }));
      if (aborted) toast("Export cancelled");
      else toast.error("Export failed", { description: (err as Error).message });
    } finally {
      abortRef.current = null;
    }
  }, [jobs, settings.matte, cancelRun, render, validOutput]);

  // ───────── Asset handlers ─────────
  const onAdd = useCallback((list: Asset[]) => setAssets((prev) => [...prev, ...list]), []);
  const onUpdate = useCallback(
    (id: string, patch: Partial<Asset>) => setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    [],
  );
  const onRemove = useCallback((id: string) => {
    setAssets((prev) => {
      const a = prev.find((x) => x.id === id);
      if (a) {
        URL.revokeObjectURL(a.thumbUrl);
        a.preview?.close();
      }
      return prev.filter((x) => x.id !== id);
    });
  }, []);
  const onClear = useCallback(async () => {
    await cancelRun();
    setAssets((prev) => {
      prev.forEach((a) => {
        URL.revokeObjectURL(a.thumbUrl);
        a.preview?.close();
      });
      return [];
    });
    Object.values(outputsRef.current).forEach((o) => o.url && URL.revokeObjectURL(o.url));
    outputsRef.current = {};
    setOutputs({});
    setRun(IDLE);
  }, [cancelRun]);

  const outputFor = useCallback(
    (assetId: string, presetId: string) => {
      const job = jobById.get(`${assetId}:${presetId}`);
      return job ? validOutput(job, outputs) : undefined;
    },
    [jobById, outputs, validOutput],
  );
  const outputForJob = useCallback((j: Job) => validOutput(j, outputs), [outputs, validOutput]);

  // ───────── Full-size preview popup ─────────
  const [previewId, setPreviewId] = useState<string | null>(null);
  const lightboxItems = useMemo<LightboxItem[]>(
    () =>
      jobs.map((j) => {
        const o = validOutput(j, outputs);
        const ext = (o?.format ?? j.enc.format) === "png" ? "png" : "jpg";
        return {
          id: j.id,
          title: `${j.preset.store === "app_store" ? "App Store" : "Google Play"} · ${j.preset.label} · ${j.locale.toUpperCase()}`,
          path: o?.path ?? `${j.pathStem}.${ext}`,
          source: assets.find((a) => a.id === j.assetId)?.name ?? "",
          width: j.size.w,
          height: j.size.h,
          status: !o ? "queued" : o.status,
          url: o?.url,
          fileName: o?.fileName,
          bytes: o?.bytes,
          format: o?.format,
          compliance: o?.compliance,
          note: o?.note,
          error: o?.error,
        };
      }),
    [jobs, outputs, assets, validOutput],
  );
  const previewIndex = previewId ? lightboxItems.findIndex((i) => i.id === previewId) : -1;
  const openPreview = useCallback((jobId: string) => setPreviewId(jobId), []);

  // ───────── Remove one output for one image ─────────
  const removeOutput = useCallback(
    (job: Job) => {
      const asset = assetsRef.current.find((a) => a.id === job.assetId);
      if (!asset) return;
      const before = asset.excluded;
      onUpdate(asset.id, { excluded: excludePreset(asset, job.preset.id) });
      toast(`Removed ${job.preset.store === "app_store" ? "iOS" : "Play"} ${job.preset.label} for ${asset.name}`, {
        description: "It won't be in the ZIP. To skip this size for every image, untick it in Export presets.",
        action: { label: "Undo", onClick: () => onUpdate(asset.id, { excluded: before }) },
      });
    },
    [onUpdate],
  );

  const percent =
    run.phase === "rendering"
      ? (run.done / Math.max(1, run.total)) * (run.kind === "export" ? 85 : 100)
      : run.phase === "zipping"
        ? 85 + run.zipPercent * 0.15
        : run.phase === "done"
          ? 100
          : 0;
  const readyCount = jobs.filter((j) => validOutput(j, outputs)?.status === "done").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-label="Assets" className="min-w-0 space-y-6">
        <ImageUploader
          assets={assets}
          settings={settings}
          outputFor={outputFor}
          onPreview={(assetId, presetId) => openPreview(`${assetId}:${presetId}`)}
          busy={exporting}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onClear={onClear}
        />
        <OutputsTable jobs={jobs} assets={assets} outputFor={outputForJob} onPreview={openPreview} onRemove={removeOutput} />
        <OutputLightbox
          items={lightboxItems}
          index={previewIndex >= 0 ? previewIndex : null}
          onIndex={(i) => setPreviewId(lightboxItems[i]?.id ?? null)}
          onClose={() => setPreviewId(null)}
        />
      </section>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-6">
        <ExportPanel
          jobs={jobs}
          run={run}
          percent={percent}
          readyCount={readyCount}
          autoGenerate={settings.autoGenerate}
          onExport={startExport}
          onCancel={() => abortRef.current?.abort()}
        />
        <PresetSelector settings={settings} onChange={setSettings} />
      </aside>
    </div>
  );
}

function ExportPanel({
  jobs,
  run,
  percent,
  readyCount,
  autoGenerate,
  onExport,
  onCancel,
}: {
  jobs: Job[];
  run: RunState;
  percent: number;
  readyCount: number;
  autoGenerate: boolean;
  onExport: () => void;
  onCancel: () => void;
}) {
  const exporting = run.kind === "export" && (run.phase === "rendering" || run.phase === "zipping");
  const tree = useMemo(() => {
    const t = new Map<string, Map<string, Map<string, number>>>();
    for (const j of jobs) {
      const s = t.get(j.preset.store) ?? new Map();
      const l = s.get(j.locale) ?? new Map();
      l.set(j.preset.folder, (l.get(j.preset.folder) ?? 0) + 1);
      s.set(j.locale, l);
      t.set(j.preset.store, s);
    }
    return t;
  }, [jobs]);

  const showProgress = run.phase !== "idle";

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/[0.04] to-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="size-4" /> Batch export
        </CardTitle>
        <CardDescription>
          {jobs.length
            ? `${readyCount}/${jobs.length} outputs ready${autoGenerate ? " · auto-generating" : ""}`
            : "Drop a Mobile or iPad set to begin."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-lg border bg-background/60 p-3 font-mono text-xs leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold">
              <FolderOpen className="size-3.5" /> app-store-assets/
            </div>
            {[...tree].map(([store, locales]) => (
              <div key={store} className="ml-3 border-l pl-2">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="size-3.5 text-muted-foreground" /> {store}/
                </div>
                {[...locales].map(([locale, folders]) => (
                  <div key={locale} className="ml-3 border-l pl-2">
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="size-3.5 text-muted-foreground" /> {locale}/
                    </div>
                    {[...folders].map(([folder, n]) => (
                      <div key={folder} className="ml-3 flex items-center justify-between border-l pl-2">
                        <span className="flex items-center gap-1.5">
                          <Folder className="size-3.5 text-muted-foreground" /> {folder}/
                        </span>
                        <span className="text-muted-foreground">{n}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            <div className="ml-3 pl-2 text-muted-foreground">manifest.json</div>
          </div>
        )}

        {showProgress && (
          <div className="space-y-1.5" aria-live="polite">
            <Progress value={percent} />
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1.5">
                {(run.phase === "rendering" || run.phase === "zipping") && <Loader2 className="size-3 shrink-0 animate-spin" />}
                {run.phase === "done" && <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />}
                {run.phase === "error" && <XCircle className="size-3 shrink-0 text-destructive" />}
                <span className="truncate">
                  {run.phase === "rendering" &&
                    `${run.kind === "auto" ? "Auto-generating" : "Rendering"} ${run.done}/${run.total} · ${run.current ?? ""}`}
                  {run.phase === "zipping" && `Compressing ZIP · ${Math.round(run.zipPercent)}%`}
                  {(run.phase === "done" || run.phase === "error") && run.message}
                </span>
              </span>
              <span className="tabular-nums">{Math.round(percent)}%</span>
            </div>
            {run.failed > 0 && <p className="text-xs text-destructive">{run.failed} render(s) failed. See the affected previews.</p>}
          </div>
        )}

        <div className="flex gap-2">
          <Button className="flex-1" size="lg" disabled={exporting || !jobs.length} onClick={onExport}>
            {exporting ? <Loader2 className="animate-spin" /> : readyCount === jobs.length && jobs.length ? <Zap /> : <FileArchive />}
            {exporting ? "Exporting…" : "Download ZIP"}
          </Button>
          {run.phase === "rendering" && (
            <Button variant="outline" size="lg" onClick={onCancel} aria-label="Cancel rendering">
              <Square /> Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
