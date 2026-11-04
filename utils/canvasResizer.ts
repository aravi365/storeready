/**
 * Canvas resizing engine — runs on the main thread or inside a Web Worker
 * (uses OffscreenCanvas when available, falls back to <canvas>).
 *
 *  • fit     — contain + letterbox over a solid colour or blurred backdrop. When the source shape is
 *              within FIT_SNAP_TOLERANCE of the target (e.g. 6.7" → 6.9"), it fills edge to edge
 *              instead, trimming at most that much, rather than adding hairline bars.
 *  • fill    — cover + smart crop (edge-energy focal point, or manual focus)
 *  • stretch — distort to exact size
 *
 * Every output is composited over an opaque matte so no alpha survives, then encoded
 * as a true 24-bit RGB PNG (see pngEncoder.ts) or an RGB JPEG.
 */
import { encodeRgbPng } from "./pngEncoder";
import type { Size } from "./presets";

export type ScaleMode = "fit" | "fill" | "stretch";
export type Backdrop = "solid" | "blur";
export type OutputFormat = "png" | "jpeg";

export interface RenderOptions {
  mode: ScaleMode;
  backdrop: Backdrop;
  /** Matte / letterbox colour, e.g. "#FFFFFF" */
  matte: string;
  /** Inner padding for fit mode, as a fraction of the shorter target side (0–0.25) */
  padding: number;
  /** Normalised focal point for fill mode (0–1). Defaults to centre. */
  focus?: { x: number; y: number };
}

export interface EncodeOptions {
  format: OutputFormat;
  /** JPEG quality 0–1 */
  quality: number;
  /** Hard size cap; PNG falls back to JPEG, JPEG steps quality down. */
  maxBytes?: number;
}

export interface RenderResult {
  blob: Blob;
  format: OutputFormat;
  width: number;
  height: number;
  /** Set when the encoder had to change format/quality to meet maxBytes */
  note?: string;
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
type Source = CanvasImageSource & { width: number; height: number };

export const MAX_INPUT_BYTES = 60 * 1024 * 1024;
export const MAX_INPUT_SIDE = 12000;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

// ───────── Canvas helpers ─────────

export function createCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(canvas: AnyCanvas, opts?: CanvasRenderingContext2DSettings): Ctx2D {
  const ctx = canvas.getContext("2d", { colorSpace: "srgb", ...opts }) as Ctx2D | null;
  if (!ctx) throw new Error("Canvas 2D context unavailable (browser may be out of memory).");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/**
 * High-quality downscale: halves the source repeatedly until within 2× of the
 * destination, avoiding the aliasing a single large-ratio drawImage produces.
 */
function drawHQ(
  ctx: Ctx2D,
  src: Source,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  let cur: Source = src;
  let cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw / dw > 2 && ch / dh > 2) {
    const nw = Math.max(1, Math.round(cw / 2));
    const nh = Math.max(1, Math.round(ch / 2));
    const tmp = createCanvas(nw, nh);
    ctx2d(tmp).drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    cur = tmp as Source;
    cx = 0; cy = 0; cw = nw; ch = nh;
  }
  ctx.drawImage(cur, cx, cy, cw, ch, dx, dy, dw, dh);
}

// ───────── Decoding & analysis ─────────

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported type "${file.type}". Use PNG or JPEG.`);
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`File is ${(file.size / 1048576).toFixed(1)} MB; the limit is 60 MB.`);
  }
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Could not decode image — the file may be corrupt.");
  }
  if (bmp.width > MAX_INPUT_SIDE || bmp.height > MAX_INPUT_SIDE) {
    bmp.close();
    throw new Error(`Image exceeds ${MAX_INPUT_SIDE}px on a side.`);
  }
  return bmp;
}

export interface IngestResult {
  width: number;
  height: number;
  /** Downsampled bitmap (≤ maxSide) for fast live previews */
  preview: ImageBitmap;
  analysis: SourceAnalysis;
}

/**
 * Decodes once, measures, analyses (alpha + focal point) and keeps only a small
 * preview bitmap in memory — the full-res decode is released immediately, so dozens
 * of 4K uploads don't exhaust memory. Full-res is re-decoded per asset at export time.
 */
export async function ingestImage(file: Blob, maxSide = 900): Promise<IngestResult> {
  const full = await decodeImage(file);
  try {
    const { width, height } = full;
    const analysis = analyzeSource(full);
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const c = createCanvas(w, h);
    drawHQ(ctx2d(c), full, 0, 0, width, height, 0, 0, w, h);
    const preview = await createImageBitmap(c);
    return { width, height, preview, analysis };
  } finally {
    full.close();
  }
}

export interface SourceAnalysis {
  hasTransparency: boolean;
  /** Edge-energy focal point (0–1) for smart crop */
  focus: { x: number; y: number };
}

/** Detects any non-opaque pixel and computes a smart-crop focal point in one pass. */
export function analyzeSource(src: Source): SourceAnalysis {
  const S = 160;
  const scale = Math.min(1, S / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const c = createCanvas(w, h);
  const ctx = ctx2d(c, { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let hasTransparency = false;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 255) hasTransparency = true;
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Sobel-ish gradient energy, centre-of-mass weighted.
  let sum = 0, sx = 0, sy = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      const e = gx * gx + gy * gy;
      sum += e;
      sx += e * x;
      sy += e * y;
    }
  }
  const raw = sum > 0 ? { x: sx / sum / w, y: sy / sum / h } : { x: 0.5, y: 0.5 };
  // Blend toward centre so a single busy corner doesn't dominate the crop.
  const focus = { x: 0.5 + (raw.x - 0.5) * 0.7, y: 0.5 + (raw.y - 0.5) * 0.7 };
  return { hasTransparency, focus };
}

// ───────── Composition ─────────

/** Largest share of one dimension Fit may trim instead of adding bars (1%). */
export const FIT_SNAP_TOLERANCE = 0.01;

export interface FitPlan {
  /** exact: same shape · snap: fills, trims ≤ tolerance · letterbox: whole image + bars */
  strategy: "exact" | "snap" | "letterbox";
  /** Share of the source cut off along one axis (snap only) */
  trim: number;
  /** Total bar size in target pixels along one axis (letterbox only) */
  bars: number;
  /** Axis the trim or bars are on */
  axis: "x" | "y" | null;
}

/**
 * Decides how Fit handles a shape mismatch. Pure, so previews, the renderer and tests agree.
 * Padding means the user asked for space, so we never trim then.
 */
export function planFit(sw: number, sh: number, tw: number, th: number, padding = 0): FitPlan {
  const sx = tw / sw;
  const sy = th / sh;
  const mismatch = 1 - Math.min(sx, sy) / Math.max(sx, sy);
  // Cover scales by the larger factor, so the other axis overflows and is trimmed.
  const trimAxis: FitPlan["axis"] = sx < sy ? "x" : "y";
  if (padding <= 0) {
    const scale = Math.min(sx, sy);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    if (dw === tw && dh === th) return { strategy: "exact", trim: 0, bars: 0, axis: null };
    if (mismatch <= FIT_SNAP_TOLERANCE) return { strategy: "snap", trim: mismatch, bars: 0, axis: trimAxis };
  }
  const pad = Math.round(Math.min(tw, th) * clamp(padding, 0, 0.25));
  const scale = Math.min((tw - pad * 2) / sw, (th - pad * 2) / sh);
  const barsX = tw - Math.round(sw * scale);
  const barsY = th - Math.round(sh * scale);
  // With padding both axes have space; report the larger gap.
  const axis = barsX >= barsY ? "x" : "y";
  return { strategy: "letterbox", trim: 0, bars: Math.max(barsX, barsY), axis: barsX === 0 && barsY === 0 ? null : axis };
}

/**
 * Draws `src` into a tw×th context according to `opts`. Pure geometry, so it works
 * identically for small live previews and full-resolution exports.
 */
export function drawComposition(ctx: Ctx2D, src: Source, tw: number, th: number, opts: RenderOptions) {
  const sw = src.width;
  const sh = src.height;

  // 1. Opaque matte — this is what strips alpha: every pixel ends at A=255.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = opts.matte;
  ctx.fillRect(0, 0, tw, th);

  if (opts.mode === "stretch") {
    drawHQ(ctx, src, 0, 0, sw, sh, 0, 0, tw, th);
    return;
  }

  if (opts.mode === "fill") {
    const scale = Math.max(tw / sw, th / sh);
    const cw = tw / scale;
    const ch = th / scale;
    const f = opts.focus ?? { x: 0.5, y: 0.5 };
    const cx = clamp(f.x * sw - cw / 2, 0, sw - cw);
    const cy = clamp(f.y * sh - ch / 2, 0, sh - ch);
    drawHQ(ctx, src, cx, cy, cw, ch, 0, 0, tw, th);
    return;
  }

  // fit
  const plan = planFit(sw, sh, tw, th, opts.padding);
  if (plan.strategy !== "letterbox") {
    // Same shape, or within 1%: fill edge to edge with an even, centred trim (no hairline bars).
    const scale = Math.max(tw / sw, th / sh);
    const cw = Math.min(sw, tw / scale);
    const ch = Math.min(sh, th / scale);
    drawHQ(ctx, src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, tw, th);
    return;
  }

  // letterbox: whole image, bars filled with the blurred backdrop or the solid matte
  if (opts.backdrop === "blur") drawBlurBackdrop(ctx, src, tw, th);

  const pad = Math.round(Math.min(tw, th) * clamp(opts.padding, 0, 0.25));
  const aw = tw - pad * 2;
  const ah = th - pad * 2;
  const scale = Math.min(aw / sw, ah / sh);
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  const dx = Math.round((tw - dw) / 2);
  const dy = Math.round((th - dh) / 2);

  // Transparent source pixels must land on the matte, not the blurred backdrop.
  if (opts.backdrop === "blur") {
    ctx.fillStyle = opts.matte;
    ctx.fillRect(dx, dy, dw, dh);
  }
  drawHQ(ctx, src, 0, 0, sw, sh, dx, dy, dw, dh);
}

/** Cheap, portable blur: cover-draw to a tiny canvas, then upscale twice with smoothing. */
function drawBlurBackdrop(ctx: Ctx2D, src: Source, tw: number, th: number) {
  const tiny = { w: Math.max(4, Math.round(tw / 48)), h: Math.max(4, Math.round(th / 48)) };
  const mid = { w: tiny.w * 6, h: tiny.h * 6 };
  const a = createCanvas(tiny.w, tiny.h);
  const actx = ctx2d(a);
  const scale = Math.max(tiny.w / src.width, tiny.h / src.height);
  const cw = tiny.w / scale;
  const ch = tiny.h / scale;
  drawHQ(actx, src, (src.width - cw) / 2, (src.height - ch) / 2, cw, ch, 0, 0, tiny.w, tiny.h);
  const b = createCanvas(mid.w, mid.h);
  ctx2d(b).drawImage(a, 0, 0, mid.w, mid.h);
  ctx.drawImage(b, 0, 0, tw, th);
  // Soften contrast so the foreground reads clearly.
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, tw, th);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// ───────── Encoding ─────────

async function canvasToJpeg(canvas: AnyCanvas, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Promise((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encoding failed"))),
      "image/jpeg",
      quality,
    ),
  );
}

/** Full-resolution render + encode for one target size. */
export async function renderToBlob(
  src: Source,
  size: Size,
  opts: RenderOptions,
  enc: EncodeOptions,
): Promise<RenderResult> {
  const canvas = createCanvas(size.w, size.h);
  const ctx = ctx2d(canvas, { alpha: false, willReadFrequently: enc.format === "png" });
  drawComposition(ctx, src, size.w, size.h, opts);

  const base = { width: size.w, height: size.h };

  if (enc.format === "png") {
    const { data } = ctx.getImageData(0, 0, size.w, size.h);
    const png = await encodeRgbPng(data, size.w, size.h);
    if (!enc.maxBytes || png.size <= enc.maxBytes) return { ...base, blob: png, format: "png" };
    // Too large: fall through to JPEG.
    const jpeg = await jpegUnder(canvas, 0.92, enc.maxBytes);
    return {
      ...base,
      ...jpeg,
      note: `PNG was ${(png.size / 1048576).toFixed(1)} MB; exported as JPEG q${Math.round(jpeg.quality * 100)} to stay under the limit.`,
    };
  }

  const jpeg = await jpegUnder(canvas, enc.quality, enc.maxBytes);
  return {
    ...base,
    ...jpeg,
    note: jpeg.quality < enc.quality ? `Quality lowered to ${Math.round(jpeg.quality * 100)} to meet size limit.` : undefined,
  };
}

async function jpegUnder(canvas: AnyCanvas, quality: number, maxBytes?: number) {
  let q = quality;
  let blob = await canvasToJpeg(canvas, q);
  while (maxBytes && blob.size > maxBytes && q > 0.5) {
    q = Math.round((q - 0.07) * 100) / 100;
    blob = await canvasToJpeg(canvas, q);
  }
  return { blob, format: "jpeg" as const, quality: q };
}
