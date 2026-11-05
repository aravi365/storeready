import type { Backdrop, EncodeOptions, OutputFormat, RenderOptions, ScaleMode, SourceAnalysis } from "./canvasResizer";
import { detectAsset, type Detection } from "./detect";
import type { ExtendChoice, QualityCheck } from "./edgeExtend";
import { storeLocale } from "./languages";
import {
  PRESETS,
  customPreset,
  type ComplianceResult,
  presetsFor,
  sizeFor,
  type Category,
  type DeviceClass,
  type Locale,
  type Orientation,
  type Preset,
  type Size,
  type Store,
} from "./presets";

export type OrientationChoice = "auto" | Orientation;

export interface Asset {
  id: string;
  file: File;
  name: string;
  thumbUrl: string;
  status: "decoding" | "ready" | "error";
  error?: string;
  width: number;
  height: number;
  preview?: ImageBitmap;
  analysis?: SourceAnalysis;
  detection?: Detection;
  /** Path inside an uploaded folder, e.g. "th/ipad/01.png" */
  relPath?: string;
  /** Preset ids the user removed for this image only (e.g. skip Play 10" tablet, keep iPad 13") */
  excluded?: string[];
  /** The upload set the file was dropped into */
  set?: DeviceClass;

  deviceClass: DeviceClass;
  locale: Locale;
  category: Category;
  orientation: OrientationChoice;
  /** Per-asset overrides; undefined = inherit global */
  mode?: ScaleMode;
  backdrop?: Backdrop;
  /** Which side(s) edge extension grows (default auto) */
  extend?: ExtendChoice;
}

export interface GlobalSettings {
  stores: Set<Store>;
  presets: Set<string>;
  /** Languages switched off for export (every detected language is included by default) */
  excludedLocales: Set<Locale>;
  format: OutputFormat;
  quality: number;
  matte: string;
  mode: ScaleMode;
  featureMode: ScaleMode;
  backdrop: Backdrop;
  padding: number;
  smartCrop: boolean;
  /** Apply auto-detected device / type / locale on upload */
  autoDetect: boolean;
  /** Render outputs automatically after upload and settings changes */
  autoGenerate: boolean;
  /** Extra W×H outputs for every image */
  customSizes: Size[];
  /** "original-size": home_2160x3840.png · "original": home.png · "numbered": 01_home_2160x3840.png */
  fileNames: FileNaming;
}

export type FileNaming = "original-size" | "original" | "numbered";

export const DEFAULT_SETTINGS: GlobalSettings = {
  stores: new Set<Store>(["app_store", "play_store"]),
  presets: new Set(PRESETS.filter((p) => p.defaultEnabled).map((p) => p.id)),
  excludedLocales: new Set<Locale>(),
  format: "png",
  quality: 0.92,
  matte: "#FFFFFF",
  mode: "fit",
  featureMode: "fill",
  backdrop: "edge",
  padding: 0,
  smartCrop: true,
  autoDetect: true,
  autoGenerate: true,
  customSizes: [],
  fileNames: "original-size",
};

export interface Job {
  id: string;
  assetId: string;
  preset: Preset;
  locale: Locale;
  size: Size;
  opts: RenderOptions;
  enc: EncodeOptions;
  /** Path inside the zip, without extension */
  pathStem: string;
}

export function resolveOrientation(asset: Pick<Asset, "orientation" | "width" | "height">): Orientation {
  if (asset.orientation !== "auto") return asset.orientation;
  return asset.width > asset.height ? "landscape" : "portrait";
}

export function renderOptionsFor(asset: Asset, s: GlobalSettings): RenderOptions {
  const mode = asset.mode ?? (asset.category === "feature_graphic" ? s.featureMode : s.mode);
  return {
    mode,
    backdrop: asset.backdrop ?? s.backdrop,
    matte: s.matte,
    padding: s.padding,
    focus: s.smartCrop ? asset.analysis?.focus : undefined,
    extend: asset.extend ?? "auto",
  };
}

function allTargetsFor(asset: Asset, s: GlobalSettings): { preset: Preset; size: Size }[] {
  const o = resolveOrientation(asset);
  const custom = asset.category === "screenshot" ? (s.customSizes ?? []).map(customPreset) : [];
  const seen = new Set<string>();
  return [...presetsFor(asset.deviceClass, asset.category, s.presets, s.stores), ...custom]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .map((preset) => ({ preset, size: sizeFor(preset, o) }));
}

/** Outputs this image will produce (enabled presets minus the ones removed for this image). */
export function targetsFor(asset: Asset, s: GlobalSettings): { preset: Preset; size: Size }[] {
  const ex = new Set(asset.excluded ?? []);
  return allTargetsFor(asset, s).filter((t) => !ex.has(t.preset.id));
}

/** Outputs removed for this image that would otherwise be produced (shown as "Restore" chips). */
export function excludedTargetsFor(asset: Asset, s: GlobalSettings): { preset: Preset; size: Size }[] {
  const ex = new Set(asset.excluded ?? []);
  return allTargetsFor(asset, s).filter((t) => ex.has(t.preset.id));
}

export const excludePreset = (asset: Pick<Asset, "excluded">, presetId: string): string[] =>
  [...new Set([...(asset.excluded ?? []), presetId])];
export const restorePreset = (asset: Pick<Asset, "excluded">, presetId: string): string[] =>
  (asset.excluded ?? []).filter((id) => id !== presetId);

const slug = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[\s._-]*/, "") // keep our own NN_ ordering prefix only
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "_") // keep combining marks (Thai vowels/tones)
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
    .toLowerCase() || "image";

/** Original file name without extension, made safe for every OS (keeps spaces, case and any script). */
export const safeBaseName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, "_")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 120) || "image";

function stemFor(naming: FileNaming, name: string, n: number, size: Size): string {
  if (naming === "original") return safeBaseName(name);
  if (naming === "original-size") return `${safeBaseName(name)}_${size.w}x${size.h}`;
  return `${String(n).padStart(2, "0")}_${slug(name)}_${size.w}x${size.h}`;
}

/** Two images with the same name in one folder get "-2", "-3"… instead of overwriting each other. */
function uniqueStem(used: Map<string, Set<string>>, folder: string, stem: string): string {
  const set = used.get(folder) ?? new Set<string>();
  used.set(folder, set);
  let out = stem;
  for (let k = 2; set.has(out.toLowerCase()); k++) out = `${stem}-${k}`;
  set.add(out.toLowerCase());
  return out;
}

export function buildJobs(assets: Asset[], s: GlobalSettings): Job[] {
  const counters = new Map<string, number>();
  const used = new Map<string, Set<string>>();
  const jobs: Job[] = [];
  for (const asset of assets) {
    if (asset.status !== "ready" || s.excludedLocales.has(asset.locale)) continue;
    const opts = renderOptionsFor(asset, s);
    for (const { preset, size } of targetsFor(asset, s)) {
      const folder = `app-store-assets/${preset.store}/${storeLocale(preset.store, asset.locale)}/${preset.folder}`;
      const n = (counters.get(folder) ?? 0) + 1;
      counters.set(folder, n);
      jobs.push({
        id: `${asset.id}:${preset.id}`,
        assetId: asset.id,
        preset,
        locale: asset.locale,
        size,
        opts,
        enc: { format: s.format, quality: s.quality, maxBytes: preset.maxBytes },
        pathStem: `${folder}/${uniqueStem(used, folder, stemFor(s.fileNames ?? "numbered", asset.name, n, size))}`,
      });
    }
  }
  return jobs;
}

/** Placeholder metadata before the image is decoded (file name only). */
export function inferMetadata(name: string) {
  const d = detectAsset(name, 1, 2, 0);
  return { category: d.category, deviceClass: d.deviceClass, locale: d.locale };
}

export interface OutputState {
  sig: string;
  status: "rendering" | "done" | "error";
  bytes?: number;
  format?: OutputFormat;
  note?: string;
  error?: string;
  url?: string;
  fileName?: string;
  path?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  compliance?: ComplianceResult;
  /** Edge-extension checks; a failure shows a "Check seam" badge */
  checks?: QualityCheck[];
  joins?: { axis: "x" | "y"; pos: number; side: string }[];
}

/** Stable signature so stale results are ignored after settings change. */
export const jobSig = (j: Pick<Job, "size" | "opts" | "enc" | "pathStem">) =>
  JSON.stringify([j.size, j.opts, j.enc, j.pathStem]);
