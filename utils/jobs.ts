import type { Backdrop, EncodeOptions, OutputFormat, RenderOptions, ScaleMode, SourceAnalysis } from "./canvasResizer";
import { detectAsset, type Detection } from "./detect";
import {
  PRESETS,
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
}

export interface GlobalSettings {
  stores: Set<Store>;
  presets: Set<string>;
  locales: Set<Locale>;
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
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  stores: new Set<Store>(["app_store", "play_store"]),
  presets: new Set(PRESETS.filter((p) => p.defaultEnabled).map((p) => p.id)),
  locales: new Set<Locale>(["en", "th"]),
  format: "png",
  quality: 0.92,
  matte: "#FFFFFF",
  mode: "fit",
  featureMode: "fill",
  backdrop: "blur",
  padding: 0,
  smartCrop: true,
  autoDetect: true,
  autoGenerate: true,
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
  };
}

function allTargetsFor(asset: Asset, s: GlobalSettings): { preset: Preset; size: Size }[] {
  const o = resolveOrientation(asset);
  return presetsFor(asset.deviceClass, asset.category, s.presets, s.stores).map((preset) => ({
    preset,
    size: sizeFor(preset, o),
  }));
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

export function buildJobs(assets: Asset[], s: GlobalSettings): Job[] {
  const counters = new Map<string, number>();
  const jobs: Job[] = [];
  for (const asset of assets) {
    if (asset.status !== "ready" || !s.locales.has(asset.locale)) continue;
    const opts = renderOptionsFor(asset, s);
    for (const { preset, size } of targetsFor(asset, s)) {
      const folder = `app-store-assets/${preset.store}/${asset.locale}/${preset.folder}`;
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
        pathStem: `${folder}/${String(n).padStart(2, "0")}_${slug(asset.name)}_${size.w}x${size.h}`,
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
}

/** Stable signature so stale results are ignored after settings change. */
export const jobSig = (j: Pick<Job, "size" | "opts" | "enc" | "pathStem">) =>
  JSON.stringify([j.size, j.opts, j.enc, j.pathStem]);
