"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import {
  AlertTriangle,
  FolderOpen,
  FolderTree,
  ScanSearch,
  Wand2,
  CheckCircle2,
  Download,
  ImagePlus,
  Loader2,
  Smartphone,
  BookOpen,
  Glasses,
  Maximize2,
  RotateCcw,
  X,
  Tablet,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/Segmented";
import { cn } from "@/lib/utils";
import {
  MAX_INPUT_BYTES,
  createCanvas,
  drawComposition,
  planFit,
  ingestImage,
  type RenderOptions,
  type ScaleMode,
} from "@/utils/canvasResizer";
import {
  excludePreset,
  excludedTargetsFor,
  restorePreset,
  inferMetadata,
  renderOptionsFor,
  resolveOrientation,
  targetsFor,
  type Asset,
  type GlobalSettings,
  type OutputState,
} from "@/utils/jobs";
import { PRESETS, STORE_LABEL, evaluate, type DeviceClass, type Preset, type Size } from "@/utils/presets";
import { detectAsset, scaleFactor, type Detection } from "@/utils/detect";
import { partitionUploads, relPathOf } from "@/utils/uploads";
import { languageName } from "@/utils/languages";
import { LanguageSelect } from "@/components/LanguageSelect";

const fmtBytes = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const STORE_SHORT = { app_store: "iOS", play_store: "Play" } as const;

const SET_NAME: Record<DeviceClass, string> = { phone: "Mobile", tablet: "iPad / Tablet", foldable: "iPhone Duo", xr: "Android XR" };

let idSeq = 0;
const newId = () => `a${Date.now().toString(36)}${(idSeq++).toString(36)}`;

// ───────────────────────── Dropzone + ingest ─────────────────────────

export function ImageUploader({
  assets,
  settings,
  outputFor,
  onPreview,
  busy,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
}: {
  assets: Asset[];
  settings: GlobalSettings;
  outputFor: (assetId: string, presetId: string) => OutputState | undefined;
  onPreview: (assetId: string, presetId: string) => void;
  busy: boolean;
  onAdd: (assets: Asset[]) => void;
  onUpdate: (id: string, patch: Partial<Asset>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const ingest = useCallback(
    async (files: File[], forcedDevice?: DeviceClass) => {
      const placeholders: Asset[] = files.map((file) => ({
        id: newId(),
        file,
        name: file.name,
        relPath: relPathOf(file),
        thumbUrl: URL.createObjectURL(file),
        status: "decoding",
        width: 0,
        height: 0,
        ...inferMetadata(relPathOf(file)),
        ...(forcedDevice ? { deviceClass: forcedDevice } : {}),
        set: forcedDevice,
        orientation: "auto",
      }));
      onAdd(placeholders);

      // Decode sequentially: bounded memory even for large batches of 4K+ images.
      for (const a of placeholders) {
        try {
          const { width, height, preview, analysis } = await ingestImage(a.file);
          const detection = detectAsset(a.relPath ?? a.name, width, height, a.file.size);
          const mismatch = forcedDevice && detection.confidence === "high" && detection.deviceClass !== forcedDevice;
          onUpdate(a.id, {
            status: "ready",
            width,
            height,
            preview,
            analysis,
            detection: mismatch
              ? {
                  ...detection,
                  notes: [
                    ...detection.notes,
                    {
                      level: "warn",
                      text: `Dropped in the ${SET_NAME[forcedDevice]} set, but it was detected as ${detection.label}.`,
                    },
                  ],
                }
              : detection,
            ...(settings.autoDetect
              ? {
                  // The set you dropped into wins for device; detection fills in type + locale.
                  deviceClass: forcedDevice ?? detection.deviceClass,
                  category: detection.category,
                  locale: detection.locale,
                }
              : {}),
          });
          if (analysis.hasTransparency) {
            toast.info(`${a.name}: transparency detected`, {
              description: `It will be flattened onto ${settings.matte} on export.`,
            });
          }
        } catch (err) {
          onUpdate(a.id, { status: "error", error: (err as Error).message });
        }
      }
    },
    [onAdd, onUpdate, settings.matte, settings.autoDetect],
  );

  const counts = {
    phone: assets.filter((a) => a.deviceClass === "phone" && a.category === "screenshot").length,
    tablet: assets.filter((a) => a.deviceClass === "tablet" && a.category === "screenshot").length,
    foldable: assets.filter((a) => a.deviceClass === "foldable" && a.category === "screenshot").length,
    xr: assets.filter((a) => a.deviceClass === "xr" && a.category === "screenshot").length,
    feature: assets.filter((a) => a.category === "feature_graphic").length,
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SetDropzone
          device="phone"
          title="Mobile set"
          subtitle="iPhone 6.9″ + 6.3″ · Play phone"
          count={counts.phone}
          busy={busy}
          onFiles={(f) => ingest(f, "phone")}
        />
        <SetDropzone
          device="tablet"
          title="iPad / Tablet set"
          subtitle="iPad 13″ · Play 10″ tablet"
          count={counts.tablet}
          busy={busy}
          onFiles={(f) => ingest(f, "tablet")}
        />
        <SetDropzone
          device="foldable"
          title="iPhone Duo set"
          subtitle="Foldable · outer + inner display"
          count={counts.foldable}
          busy={busy}
          onFiles={(f) => ingest(f, "foldable")}
        />
        <SetDropzone
          device="xr"
          title="Android XR set"
          subtitle="Play XR · 3840×2400 (8:5)"
          count={counts.xr}
          busy={busy}
          onFiles={(f) => ingest(f, "xr")}
        />
      </div>
      <FolderImportZone busy={busy} onFiles={(f) => ingest(f)} />
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        PNG or JPEG up to 60 MB · drop several folders at once · feature graphics (≈1024×500) are picked up automatically from either zone · files never
        leave your browser
      </p>

      {assets.length === 0 && <EmptyState settings={settings} />}

      {assets.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip>{assets.length} sources</Chip>
            <Chip>{counts.phone} mobile</Chip>
            <Chip>{counts.tablet} tablet</Chip>
            {counts.foldable > 0 && <Chip>{counts.foldable} Duo</Chip>}
            {counts.xr > 0 && <Chip>{counts.xr} XR</Chip>}
            {counts.feature > 0 && <Chip>{counts.feature} feature</Chip>}
            {languageCounts(assets).map(([id, n]) => (
              <Chip key={id}>
                {n} {languageName(id)}
              </Chip>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
            <Trash2 /> Clear all
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {assets.map((a) => (
          <AssetCard
            key={a.id}
            asset={a}
            settings={settings}
            outputFor={outputFor}
            onPreview={onPreview}
            busy={busy}
            onUpdate={(p) => onUpdate(a.id, p)}
            onRemove={() => onRemove(a.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Per-asset card ─────────────────────────

function AssetCard({
  asset: a,
  settings,
  outputFor,
  onPreview,
  busy,
  onUpdate,
  onRemove,
}: {
  asset: Asset;
  settings: GlobalSettings;
  outputFor: (assetId: string, presetId: string) => OutputState | undefined;
  onPreview: (assetId: string, presetId: string) => void;
  busy: boolean;
  onUpdate: (patch: Partial<Asset>) => void;
  onRemove: () => void;
}) {
  const ready = a.status === "ready";
  const isFeature = a.category === "feature_graphic";
  const targets = ready ? targetsFor(a, settings) : [];
  const removed = ready ? excludedTargetsFor(a, settings) : [];
  const removeOutput = (preset: Preset) => {
    const before = a.excluded;
    onUpdate({ excluded: excludePreset(a, preset.id) });
    toast(`Removed ${STORE_SHORT[preset.store]} ${preset.label} for ${a.name}`, {
      description: "It won't be in the ZIP. To skip this size for every image, untick it in Export presets.",
      action: { label: "Undo", onClick: () => onUpdate({ excluded: before }) },
    });
  };
  const opts = renderOptionsFor(a, settings);
  const localeOff = settings.excludedLocales.has(a.locale);
  const lock = busy || !ready;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      {/* Header + controls */}
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex min-w-0 items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.thumbUrl}
            alt=""
            className="size-14 shrink-0 rounded-md border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:12px_12px] object-contain"
          />
          <div className="min-w-0 space-y-1">
            <p className="truncate font-medium" title={a.relPath ?? a.name}>
              {a.name}
            </p>
            {a.relPath && a.relPath !== a.name && (
              <p className="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
                <FolderOpen className="size-3 shrink-0" /> {a.relPath.split("/").slice(0, -1).join("/")}/
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {a.status === "decoding" && (
                <span className="flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> Decoding…
                </span>
              )}
              {ready && (
                <span className="font-mono tabular-nums">
                  {a.width}×{a.height}
                </span>
              )}
              <span>· {fmtBytes(a.file.size)}</span>
              {a.analysis?.hasTransparency && (
                <Badge variant="outline" className="h-5 gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-3" /> Alpha → flattened
                </Badge>
              )}
              {localeOff && (
                <Badge variant="secondary" className="h-5">
                  {languageName(a.locale)} not exported
                </Badge>
              )}
            </div>
            {a.status === "error" && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="size-4" /> {a.error}
              </p>
            )}
          </div>
        </div>

        {a.detection && <DetectionRow asset={a} detection={a.detection} onApply={onUpdate} disabled={lock} />}

        <div className={cn("flex flex-wrap items-center gap-2", lock && "pointer-events-none opacity-50")}>
          <Segmented
            size="sm"
            aria-label="Output type"
            value={a.category}
            onChange={(category) => onUpdate({ category })}
            options={[
              { value: "screenshot", label: "Screenshot" },
              { value: "feature_graphic", label: "Feature" },
            ]}
          />
          <Segmented
            size="sm"
            aria-label="Device"
            className={cn(isFeature && "pointer-events-none opacity-40")}
            value={a.deviceClass}
            onChange={(deviceClass) => onUpdate({ deviceClass })}
            options={[
              { value: "phone", label: <><Smartphone className="size-3" /> iPhone / Mobile</> },
              { value: "tablet", label: <><Tablet className="size-3" /> iPad / Tablet</> },
              { value: "foldable", label: <><BookOpen className="size-3" /> iPhone Duo</> },
              { value: "xr", label: <><Glasses className="size-3" /> Android XR</> },
            ]}
          />
          <LanguageSelect size="sm" aria-label="Language" value={a.locale} onChange={(locale) => onUpdate({ locale })} className="w-44" />
          <Segmented
            size="sm"
            aria-label="Orientation"
            className={cn((isFeature || a.deviceClass === "xr") && "pointer-events-none opacity-40")}
            value={a.orientation}
            onChange={(orientation) => onUpdate({ orientation })}
            options={[
              { value: "auto", label: `Auto (${ready ? resolveOrientation(a)[0].toUpperCase() : "–"})` },
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
          <Segmented<"inherit" | ScaleMode>
            size="sm"
            aria-label="Scaling mode"
            value={a.mode ?? "inherit"}
            onChange={(v) => onUpdate({ mode: v === "inherit" ? undefined : v })}
            options={[
              { value: "inherit", label: "Default", title: "Use the global scaling setting" },
              { value: "fit", label: "Fit" },
              { value: "fill", label: "Fill" },
              { value: "stretch", label: "Stretch" },
            ]}
          />
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.name}`} onClick={onRemove} className="pointer-events-auto">
            <Trash2 />
          </Button>
        </div>
      </div>

      {opts.mode === "stretch" && ready && (
        <p className="flex items-center gap-1.5 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-3.5" /> Stretch distorts the image. Stores may reject screenshots that don’t
          accurately show the app.
        </p>
      )}

      {/* Side-by-side previews */}
      {ready && (
        <div className={cn("flex gap-4 overflow-x-auto p-4", localeOff && "opacity-50")}>
          <figure className="shrink-0 space-y-1.5">
            <div className="flex h-[220px] items-center justify-center rounded-md border bg-muted/40 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.thumbUrl} alt="Original" className="max-h-full max-w-[260px] object-contain" />
            </div>
            <figcaption className="text-xs">
              <span className="font-medium">Original</span>
              <span className="block font-mono text-muted-foreground">
                {a.width}×{a.height}
              </span>
            </figcaption>
          </figure>
          <div className="w-px shrink-0 bg-border" />
          {targets.length === 0 ? (
            <p className="self-center text-sm text-muted-foreground">
              {removed.length
                ? "All outputs for this image are removed. Restore one below."
                : <>No enabled presets match this {isFeature ? "feature graphic" : `${SET_NAME[a.deviceClass]} screenshot`}. Enable one in Export presets.</>}
            </p>
          ) : (
            targets.map(({ preset, size }) => (
              <PreviewTile
                key={preset.id}
                asset={a}
                preset={preset}
                size={size}
                opts={opts}
                settings={settings}
                output={outputFor(a.id, preset.id)}
                onPreview={() => onPreview(a.id, preset.id)}
                onRemove={lock ? undefined : () => removeOutput(preset)}
              />
            ))
          )}
        </div>
      )}

      {ready && removed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5 text-xs">
          <span className="text-muted-foreground">Removed for this image:</span>
          {removed.map(({ preset, size }) => (
            <button
              key={preset.id}
              type="button"
              disabled={lock}
              onClick={() => onUpdate({ excluded: restorePreset(a, preset.id) })}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-50"
              title={`Restore ${STORE_SHORT[preset.store]} ${preset.label} ${size.w}×${size.h}`}
            >
              <RotateCcw className="size-3" /> {STORE_SHORT[preset.store]} · {preset.label}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── Live preview tile ─────────────────────────

const PREVIEW_H = 220;
const PREVIEW_MAX_W = 360;

function PreviewTile({
  asset,
  preset,
  size,
  opts,
  settings,
  output,
  onPreview,
  onRemove,
}: {
  asset: Asset;
  preset: Preset;
  size: Size;
  opts: RenderOptions;
  settings: GlobalSettings;
  output?: OutputState;
  onPreview: () => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);

  // Display box: fixed height, width capped (feature graphic is very wide).
  const scale = Math.min(PREVIEW_H / size.h, PREVIEW_MAX_W / size.w);
  const dw = Math.round(size.w * scale);
  const dh = Math.round(size.h * scale);

  useEffect(() => {
    const canvas = ref.current;
    const src = asset.preview;
    if (!canvas || !src) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(dw * dpr);
    const ch = Math.round(dh * dpr);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    // Preview renders the same composition the exporter uses, just at screen scale.
    const tmp = createCanvas(cw, ch);
    const tctx = tmp.getContext("2d") as CanvasRenderingContext2D;
    drawComposition(tctx, src, cw, ch, opts);
    ctx.drawImage(tmp, 0, 0);
  }, [asset.preview, dw, dh, opts.mode, opts.backdrop, opts.matte, opts.padding, opts.focus?.x, opts.focus?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const compliance = evaluate(preset, size, {
    hasAlpha: false,
    format: output?.format ?? settings.format,
    bytes: output?.status === "done" ? output.bytes : undefined,
  });
  const ok = compliance.ok && output?.status !== "error";
  const fit = opts.mode === "fit" ? planFit(asset.width, asset.height, size.w, size.h, opts.padding) : null;
  // When Fit snaps (fills edge to edge) it scales like Fill.
  const factor = scaleFactor({ w: asset.width, h: asset.height }, size, fit && fit.strategy !== "letterbox" ? "fill" : opts.mode);
  const fitNote = !fit
    ? null
    : fit.strategy === "exact"
      ? "fills exactly"
      : fit.strategy === "snap"
        ? `edge trim ${(fit.trim * 100).toFixed(2)}% (≈${Math.round(fit.trim * (fit.axis === "x" ? asset.width : asset.height))} px)`
        : fit.bars > 0
          ? `bars ${fit.bars} px`
          : null;

  return (
    <figure className="shrink-0 space-y-1.5" style={{ width: Math.max(dw, 132) }}>
      <div className="relative flex items-center justify-center" style={{ height: PREVIEW_H }}>
        <div className="relative">
        <button
          type="button"
          onClick={onPreview}
          className="group/tile relative cursor-zoom-in rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Open ${preset.label} ${size.w}×${size.h} preview`}
          title="Open full-size preview"
        >
          <canvas ref={ref} style={{ width: dw, height: dh }} className="block rounded-md border shadow-sm" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/0 opacity-0 transition group-hover/tile:bg-black/35 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100">
            <span className="flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow">
              <Maximize2 className="size-3" /> Preview
            </span>
          </span>
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${preset.label} ${size.w}×${size.h} for this image`}
            title="Remove this output for this image"
            className="absolute -top-2 -right-2 z-10 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:border-destructive/50 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" />
          </button>
        )}
        </div>
        {output?.status === "rendering" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>
      <figcaption className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-medium" title={`${STORE_LABEL[preset.store]} · ${preset.label}`}>
            {preset.store === "app_store" ? "iOS" : "Play"} · {preset.label}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-muted-foreground tabular-nums">
            {size.w}×{size.h}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              ok
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
            {ok ? "Compliant" : "Check"}
          </button>
        </div>
        {open && (
          <ul className="space-y-0.5 rounded-md border bg-muted/40 p-1.5">
            {compliance.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-1">
                {c.ok ? (
                  <CheckCircle2 className="mt-px size-3 shrink-0 text-emerald-600" />
                ) : c.level === "warn" ? (
                  <AlertTriangle className="mt-px size-3 shrink-0 text-amber-600" />
                ) : (
                  <XCircle className="mt-px size-3 shrink-0 text-destructive" />
                )}
                <span>{c.label}</span>
              </li>
            ))}
            {preset.warning && <li className="text-amber-700 dark:text-amber-400">{preset.warning}</li>}
          </ul>
        )}
        <div
          className={cn(
            "font-mono text-xs tabular-nums",
            factor > 1.25 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
          )}
          title={factor > 1 ? "Source is upscaled to reach this size" : "Source is downscaled"}
        >
          {factor > 1.005 ? "↑" : factor < 0.995 ? "↓" : "="} {factor.toFixed(2)}× {factor > 1.25 && "· may look soft"}
        </div>
        {fitNote && (
          <div
            className="font-mono text-xs text-muted-foreground"
            title={
              fit?.strategy === "snap"
                ? "Shapes differ by under 1%, so Fit fills the frame and trims this much evenly instead of adding hairline bars"
                : fit?.strategy === "letterbox"
                  ? "The whole image is kept; this much space is filled with the background"
                  : undefined
            }
          >
            {fitNote}
          </div>
        )}
        {output?.status === "done" && (
          <div className="flex items-center justify-between text-muted-foreground">
            <span>
              {output.format?.toUpperCase()} · {fmtBytes(output.bytes ?? 0)}
            </span>
            {output.url && (
              <a
                href={output.url}
                download={output.fileName}
                className="inline-flex items-center gap-0.5 text-foreground hover:underline"
                aria-label={`Download ${output.fileName}`}
              >
                <Download className="size-3" />
              </a>
            )}
          </div>
        )}
        {output?.note && <p className="text-amber-700 dark:text-amber-400">{output.note}</p>}
        {output?.status === "error" && <p className="text-destructive">{output.error}</p>}
      </figcaption>
    </figure>
  );
}

// ───────────────────────── Detection row ─────────────────────────

const SOURCE_LABEL: Record<Detection["source"], string> = {
  exact: "exact resolution match",
  ratio: "aspect ratio",
  filename: "file name",
};

function DetectionRow({
  asset: a,
  detection: d,
  onApply,
  disabled,
}: {
  asset: Asset;
  detection: Detection;
  onApply: (patch: Partial<Asset>) => void;
  disabled: boolean;
}) {
  const matches = a.deviceClass === d.deviceClass && a.category === d.category && a.locale === d.locale;
  return (
    <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ScanSearch className="size-3.5 text-primary" />
        <span>
          Detected <span className="font-medium text-foreground">{d.label}</span>
        </span>
        <span className="text-muted-foreground">
          · {d.aspect} · {languageName(d.locale)} · from {SOURCE_LABEL[d.source]}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "h-5",
            d.confidence === "high" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
            d.confidence === "low" && "border-amber-500/40 text-amber-700 dark:text-amber-400",
          )}
        >
          {d.confidence} confidence
        </Badge>
        {!matches && (
          <Button
            variant="outline"
            size="xs"
            disabled={disabled}
            onClick={() => onApply({ deviceClass: d.deviceClass, category: d.category, locale: d.locale, orientation: "auto" })}
          >
            <Wand2 /> Apply detected
          </Button>
        )}
      </div>
      {d.notes.map((n) => (
        <p
          key={n.text}
          className={cn(
            "flex items-start gap-1",
            n.level === "warn" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          <AlertTriangle className="mt-px size-3 shrink-0" /> {n.text}
        </p>
      ))}
    </div>
  );
}

// ───────────────────────── Files & folders ─────────────────────────

const ACCEPT_ATTR = "image/png,image/jpeg,.png,.jpg,.jpeg";

/** Keeps PNG/JPEG under the size limit, drops hidden files, and reports the rest in one toast. */
function filterUploads(files: File[]): File[] {
  const { images, wrongType, tooBig, folders } = partitionUploads(files);
  const skipped = [
    wrongType && `${wrongType} not PNG/JPEG`,
    tooBig && `${tooBig} over ${MAX_INPUT_BYTES / 1048576} MB`,
  ].filter(Boolean);
  if (!images.length) {
    toast.error("No PNG or JPEG images found", { description: skipped.join(" · ") || undefined });
  } else if (folders || skipped.length) {
    toast.success(
      `Imported ${images.length} image${images.length === 1 ? "" : "s"}${folders ? ` from ${folders} folder${folders === 1 ? "" : "s"}` : ""}`,
      { description: skipped.length ? `Skipped ${skipped.join(" · ")}` : undefined },
    );
  }
  return images;
}

function onDropRejected(rejections: FileRejection[]) {
  filterUploads(rejections.map((r) => r.file));
}

/** "Choose folder" button. Pick as many folders as you like, one after another. */
function FolderButton({
  onFiles,
  disabled,
  label = "Choose folder",
  variant = "link",
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  variant?: "link" | "button";
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Not in React's typings; enables folder selection in all modern browsers.
    ref.current?.setAttribute("webkitdirectory", "");
    ref.current?.setAttribute("directory", "");
  }, []);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        aria-label={label}
        data-folder-input
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          const images = filterUploads(files);
          if (images.length) onFiles(images);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          ref.current?.click();
        }}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium text-primary disabled:opacity-50",
          variant === "link" ? "hover:underline" : "h-8 rounded-lg border bg-background px-3 hover:bg-muted",
        )}
      >
        <FolderOpen className="size-3.5" /> {label}
      </button>
    </>
  );
}

// ───────────────────────── Set dropzone ─────────────────────────

function SetDropzone({
  device,
  title,
  subtitle,
  count,
  busy,
  onFiles,
}: {
  device: DeviceClass;
  title: string;
  subtitle: string;
  count: number;
  busy: boolean;
  onFiles: (files: File[]) => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    // No `accept` here: dropped folders can hold anything, so we filter (and summarise) ourselves.
    onDrop: (accepted) => {
      const images = filterUploads(accepted);
      if (images.length) onFiles(images);
    },
    onDropRejected,
    multiple: true,
    disabled: busy,
  });
  const Icon = { phone: Smartphone, tablet: Tablet, foldable: BookOpen, xr: Glasses }[device];
  return (
    <div
      {...getRootProps()}
      data-set={device}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3.5 overflow-hidden rounded-2xl border border-dashed p-4 transition-all",
        "bg-gradient-to-br from-card to-muted/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
        isDragActive ? "border-primary ring-4 ring-primary/15" : "border-border hover:border-primary/40",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <input {...getInputProps({ accept: ACCEPT_ATTR })} aria-label={`Upload ${title}`} />
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
          {
            phone: "bg-gradient-to-br from-violet-500 to-indigo-600",
            tablet: "bg-gradient-to-br from-sky-500 to-cyan-600",
            foldable: "bg-gradient-to-br from-emerald-500 to-teal-600",
            xr: "bg-gradient-to-br from-rose-500 to-orange-500",
          }[device],
        )}
      >
        {isDragActive ? <ImagePlus className="size-6" /> : <Icon className="size-6" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold whitespace-nowrap">
          {title}
          {count > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{count}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Upload className="size-3" /> {isDragActive ? "Drop to add" : "Drop files or folders"}
          </span>
          <FolderButton onFiles={onFiles} disabled={busy} />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Smart folder import ─────────────────────────

/** Drop a whole tree (e.g. en-US/iphone, ja/ipad): device + locale come from folder names and image sizes. */
function FolderImportZone({ busy, onFiles }: { busy: boolean; onFiles: (files: File[]) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      const images = filterUploads(accepted);
      if (images.length) onFiles(images);
    },
    onDropRejected,
    multiple: true,
    noClick: true,
    disabled: busy,
  });
  return (
    <div
      {...getRootProps()}
      data-set="auto"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-dashed px-5 py-3.5 transition-all",
        isDragActive ? "border-primary bg-primary/5 ring-4 ring-primary/15" : "border-border bg-card/40 hover:border-primary/40",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <input {...getInputProps({ accept: ACCEPT_ATTR })} aria-label="Import folders" />
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
        <FolderTree className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{isDragActive ? "Drop folders to import" : "Smart folder import"}</p>
        <p className="text-xs text-muted-foreground">
          Drop one or more folders, e.g. <code className="font-mono">en-US/iphone</code>, <code className="font-mono">ja/ipad</code>.
          Device and language are read from folder names and image sizes.
        </p>
      </div>
      <FolderButton onFiles={onFiles} disabled={busy} label="Choose folder" variant="button" />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border bg-card px-2.5 py-0.5 text-muted-foreground">{children}</span>;
}

// ───────────────────────── Empty state ─────────────────────────

/** Before any upload: what you'll get, from the presets currently enabled. */
function EmptyState({ settings }: { settings: GlobalSettings }) {
  const enabled = PRESETS.filter((p) => settings.stores.has(p.store) && settings.presets.has(p.id));
  const steps = [
    { n: 1, title: "Drop your sets", text: "Phone, iPad and iPhone Duo screenshots, as files or whole folders." },
    { n: 2, title: "Check the previews", text: "Each image is detected and resized; every file gets a compliance badge." },
    { n: 3, title: "Download one ZIP", text: "Sorted by store, language and device, ready to upload." },
  ];
  return (
    <Card className="gap-0 p-0">
      <div className="grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-3">
        {steps.map((st) => (
          <div key={st.n} className="bg-card p-4">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{st.n}</span>
            <p className="mt-2 text-sm font-semibold">{st.title}</p>
            <p className="text-xs text-muted-foreground">{st.text}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm font-semibold">What you&apos;ll get for each screenshot</p>
        {enabled.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sizes are enabled. Turn some on in Export presets.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["app_store", "play_store"] as const).map((store) => {
              const list = enabled.filter((p) => p.store === store);
              if (!list.length) return null;
              return (
                <div key={store}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">{STORE_LABEL[store]}</p>
                  <ul className="space-y-1">
                    {list.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
                        <span className="flex items-center gap-2">
                          {p.category === "feature_graphic" ? (
                            <ImagePlus className="size-3.5 text-muted-foreground" />
                          ) : p.deviceClass === "tablet" ? (
                            <Tablet className="size-3.5 text-muted-foreground" />
                          ) : p.deviceClass === "foldable" ? (
                            <BookOpen className="size-3.5 text-muted-foreground" />
                          ) : p.deviceClass === "xr" ? (
                            <Glasses className="size-3.5 text-muted-foreground" />
                          ) : (
                            <Smartphone className="size-3.5 text-muted-foreground" />
                          )}
                          {p.label}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {p.portrait.w}×{p.portrait.h}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Languages in use, most images first. */
function languageCounts(assets: Asset[]): [string, number][] {
  const m = new Map<string, number>();
  for (const a of assets) m.set(a.locale, (m.get(a.locale) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}
