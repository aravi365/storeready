/**
 * Edge extension: grows the canvas to the store size by continuing the screenshot's own
 * background from its plainest edge. No cropping, no bars, no blurred duplicates.
 *
 *  1. Fit the source on one axis (contain); the other axis has a band to fill.
 *  2. Score a ~60 px strip at each candidate edge by its texture (luminance std dev). The lower
 *     score is the plainer background; near-equal plain edges split the band between them.
 *     (Mean luminance is only a tie-breaker: adding it to the score would make a plain white
 *     edge lose to a busy grey one, so white-background apps would extend from their content.)
 *  3. Fill colour = the outermost ~6 px at that edge, averaged to a 1 px row (keeping
 *     horizontal variation like gradients), lightly blurred, stretched over the whole canvas.
 *  4. Draw the scaled screenshot on top with a short feathered alpha ramp where it meets
 *     the band (≈4% of the long side, never more than the band allows).
 *
 * Everything here is pure pixel math on RGBA arrays, so it runs in a worker and in tests.
 */

export type Side = "top" | "bottom" | "left" | "right";
export type ExtendChoice = "auto" | "top" | "bottom" | "top-bottom" | "left" | "right" | "left-right";

export const STRIP_DEPTH = 60;
export const EDGE_ROWS = 6;
export const FILL_BLUR = 6;
/** Feather depth as a share of the long side (150 px at 3840) */
export const FEATHER_RATIO = 150 / 3840;
/** Edges with a std dev under this are "plain" */
export const PLAIN_STD = 10;
/** Plain edges whose texture differs by less than this split the band… */
export const SAME_SCORE = 4;
/** …as long as their brightness is this close too */
export const SAME_MEAN = 20;

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

// ───────────────────────── Layout ─────────────────────────

export interface ExtendLayout {
  /** Axis that gets the band: "y" = extend top/bottom, "x" = extend left/right, null = same shape */
  axis: "x" | "y" | null;
  /** Scaled screenshot size and position on the target canvas */
  dw: number;
  dh: number;
  dx: number;
  dy: number;
  /** Total band size along the axis */
  band: number;
  sides: Side[];
  /** Join lines in target pixels (where the screenshot meets the band) */
  joins: { axis: "x" | "y"; pos: number; side: Side }[];
  feather: number;
}

/** Contain-scale: fits on one axis, shorter (never cropped) on the other. */
export function fitSize(sw: number, sh: number, tw: number, th: number) {
  const scale = Math.min(tw / sw, th / sh);
  // Snap the fitted axis to the exact target so no hairline gap appears from rounding.
  const byWidth = tw / sw <= th / sh;
  const dw = byWidth ? tw : Math.min(tw, Math.round(sw * scale));
  const dh = byWidth ? Math.min(th, Math.round(sh * scale)) : th;
  const axis: ExtendLayout["axis"] = dw === tw && dh === th ? null : byWidth ? "y" : "x";
  return { scale, dw, dh, axis };
}

export function featherFor(tw: number, th: number, band: number, extent: number): number {
  if (band <= 0) return 0;
  const want = Math.round(FEATHER_RATIO * Math.max(tw, th));
  // A 3 px band must not fade 150 px of real content; and never more than a third of the image.
  return Math.max(1, Math.min(want, Math.ceil(band * 1.5) + 2, Math.floor(extent / 3)));
}

/** Positions the screenshot for the chosen side(s) and reports where the joins are. */
export function layoutFor(sw: number, sh: number, tw: number, th: number, sides: Side[]): ExtendLayout {
  const { dw, dh, axis } = fitSize(sw, sh, tw, th);
  if (!axis) return { axis, dw, dh, dx: 0, dy: 0, band: 0, sides: [], joins: [], feather: 0 };
  const band = axis === "y" ? th - dh : tw - dw;
  const has = (s: Side) => sides.includes(s);
  let off: number;
  if (axis === "y") off = has("top") && has("bottom") ? Math.round(band / 2) : has("top") ? band : 0;
  else off = has("left") && has("right") ? Math.round(band / 2) : has("left") ? band : 0;
  const dx = axis === "x" ? off : 0;
  const dy = axis === "y" ? off : 0;
  const joins: ExtendLayout["joins"] = [];
  if (axis === "y") {
    if (dy > 0) joins.push({ axis: "y", pos: dy, side: "top" });
    if (dy + dh < th) joins.push({ axis: "y", pos: dy + dh, side: "bottom" });
  } else {
    if (dx > 0) joins.push({ axis: "x", pos: dx, side: "left" });
    if (dx + dw < tw) joins.push({ axis: "x", pos: dx + dw, side: "right" });
  }
  const used = joins.map((j) => j.side);
  const extent = axis === "y" ? dh : dw;
  const perSide = used.length === 2 ? Math.min(off, band - off) : band;
  return { axis, dw, dh, dx, dy, band, sides: used, joins, feather: featherFor(tw, th, perSide, extent) };
}

// ───────────────────────── Edge analysis ─────────────────────────

export interface EdgeScore {
  side: Side;
  mean: number;
  std: number;
  score: number;
}

/** Texture (luminance std dev) and mean luminance of a strip at one edge. */
export function edgeScore(px: Pixels, side: Side, depth = STRIP_DEPTH): EdgeScore {
  const { data, width: w, height: h } = px;
  const d = Math.max(1, Math.min(depth, side === "top" || side === "bottom" ? Math.floor(h / 4) : Math.floor(w / 4)));
  const [x0, x1, y0, y1] =
    side === "top" ? [0, w, 0, d] : side === "bottom" ? [0, w, h - d, h] : side === "left" ? [0, d, 0, h] : [w - d, w, 0, h];
  let n = 0, sum = 0, sq = 0;
  // Sample every other pixel on big strips: plenty for a mean and std dev.
  const step = (x1 - x0) * (y1 - y0) > 200_000 ? 2 : 1;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * w + x) * 4;
      const L = lum(data[i], data[i + 1], data[i + 2]);
      sum += L;
      sq += L * L;
      n++;
    }
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sq / n - mean * mean));
  // Texture decides; luminance only breaks ties between equally plain edges.
  return { side, mean, std, score: std + mean / 1000 };
}

/**
 * Pixel sizes in the spec (60 px strip, 6 px edge, 6 px blur) are for a 3840 px output.
 * Scale them to the actual output so a small preview and the full-size export decide alike.
 */
export function edgeParams(targetLongSide: number) {
  const k = targetLongSide / 3840;
  return { depth: Math.max(3, Math.round(STRIP_DEPTH * k)), rows: Math.max(1, Math.round(EDGE_ROWS * k)), blur: Math.max(0.5, FILL_BLUR * k) };
}

/** Picks the side(s) to extend on an axis, or applies the user's override. */
export function chooseSides(
  px: Pixels,
  axis: "x" | "y",
  choice: ExtendChoice = "auto",
  depth = STRIP_DEPTH,
): { sides: Side[]; scores: EdgeScore[] } {
  const [a, b]: Side[] = axis === "y" ? ["top", "bottom"] : ["left", "right"];
  const scores = [edgeScore(px, a, depth), edgeScore(px, b, depth)];
  const forced: Record<ExtendChoice, Side[] | null> = {
    auto: null,
    top: ["top"],
    bottom: ["bottom"],
    "top-bottom": ["top", "bottom"],
    left: ["left"],
    right: ["right"],
    "left-right": ["left", "right"],
  };
  const f = forced[choice];
  // An override for the other axis (e.g. "left" when the band is top/bottom) falls back to auto.
  if (f && f.every((s) => s === a || s === b)) return { sides: f, scores };
  const [sa, sb] = scores;
  const plainA = sa.std < PLAIN_STD;
  const plainB = sb.std < PLAIN_STD;
  if (plainA && plainB) {
    // Both plain: split only when they're also alike in colour; otherwise prefer the top (or left),
    // which in app screenshots is usually the background (the bottom is often a tab bar).
    if (Math.abs(sa.mean - sb.mean) < SAME_MEAN && Math.abs(sa.std - sb.std) < SAME_SCORE) return { sides: [a, b], scores };
    return { sides: [a], scores };
  }
  return { sides: [sa.score <= sb.score ? a : b], scores };
}

/**
 * The fill: the outermost `rows` lines at an edge, averaged to one line (RGB per position along
 * the edge), then blurred along the edge. Horizontal variation such as gradients is kept.
 */
export function edgeLine(px: Pixels, side: Side, rows = EDGE_ROWS, blur = FILL_BLUR): Float32Array {
  const { data, width: w, height: h } = px;
  const horizontal = side === "top" || side === "bottom";
  const len = horizontal ? w : h;
  const depth = Math.max(1, Math.min(rows, horizontal ? h : w));
  const line = new Float32Array(len * 3);
  for (let k = 0; k < depth; k++) {
    for (let t = 0; t < len; t++) {
      const x = horizontal ? t : side === "left" ? k : w - 1 - k;
      const y = horizontal ? (side === "top" ? k : h - 1 - k) : t;
      const i = (y * w + x) * 4;
      line[t * 3] += data[i];
      line[t * 3 + 1] += data[i + 1];
      line[t * 3 + 2] += data[i + 2];
    }
  }
  for (let i = 0; i < line.length; i++) line[i] /= depth;
  return gaussian1d(line, 3, blur);
}

/** Separable Gaussian along a 1-px line (edge-clamped). */
export function gaussian1d(line: Float32Array, channels: number, sigma: number): Float32Array {
  if (sigma <= 0) return line;
  const r = Math.ceil(sigma * 3);
  const k = new Float32Array(r * 2 + 1);
  let ks = 0;
  for (let i = -r; i <= r; i++) ks += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= ks;
  const n = line.length / channels;
  const out = new Float32Array(line.length);
  for (let t = 0; t < n; t++) {
    for (let c = 0; c < channels; c++) {
      let v = 0;
      for (let j = -r; j <= r; j++) v += k[j + r] * line[Math.min(n - 1, Math.max(0, t + j)) * channels + c];
      out[t * channels + c] = v;
    }
  }
  return out;
}

/** Turns a line into RGBA pixels (1 px thick) ready for putImageData. */
export function lineToRgba(line: Float32Array): Uint8ClampedArray {
  const n = line.length / 3;
  const out = new Uint8ClampedArray(n * 4);
  for (let t = 0; t < n; t++) {
    out[t * 4] = line[t * 3];
    out[t * 4 + 1] = line[t * 3 + 1];
    out[t * 4 + 2] = line[t * 3 + 2];
    out[t * 4 + 3] = 255;
  }
  return out;
}

// ───────────────────────── Quality checks ─────────────────────────

export interface QualityCheck {
  label: string;
  ok: boolean;
}

/** Mean luminance of `count` lines parallel to a join, starting at `from` (inclusive). */
function bandMean(px: Pixels, axis: "x" | "y", from: number, count: number): number {
  const { data, width: w, height: h } = px;
  let sum = 0, n = 0;
  for (let k = 0; k < count; k++) {
    const p = from + k;
    if (axis === "y" ? p < 0 || p >= h : p < 0 || p >= w) continue;
    const len = axis === "y" ? w : h;
    for (let t = 0; t < len; t += 2) {
      const x = axis === "y" ? t : p;
      const y = axis === "y" ? p : t;
      const i = (y * w + x) * 4;
      sum += lum(data[i], data[i + 1], data[i + 2]);
      n++;
    }
  }
  return n ? sum / n : 0;
}

export const SEAM_MAX_DELTA = 3;

/**
 * Checks an output after edge extension:
 *  • seam: the 5 lines on each side of every join differ by < 3 in mean luminance
 *  • no pure-black lines in the band, unless the source edge itself was black
 *  • the whole scaled screenshot sits inside the canvas (nothing cropped)
 *  • no transparent pixels anywhere
 */
export function checkExtension(out: Pixels, layout: ExtendLayout, sourceEdgeMeans: Partial<Record<Side, number>>): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const { width: w, height: h, data } = out;

  for (const j of layout.joins) {
    const before = bandMean(out, j.axis, j.pos - 5, 5);
    const after = bandMean(out, j.axis, j.pos, 5);
    const delta = Math.abs(before - after);
    checks.push({ label: `Seam at ${j.side} blends (Δ ${delta.toFixed(1)} < ${SEAM_MAX_DELTA})`, ok: delta < SEAM_MAX_DELTA });
  }

  if (layout.axis) {
    let blackLines = 0;
    const ranges: [number, number, Side][] =
      layout.axis === "y"
        ? [[0, layout.dy, "top"], [layout.dy + layout.dh, h, "bottom"]]
        : [[0, layout.dx, "left"], [layout.dx + layout.dw, w, "right"]];
    for (const [a, b, side] of ranges) {
      if ((sourceEdgeMeans[side] ?? 255) < 8) continue; // the source edge is black itself
      for (let p = a; p < b; p++) {
        const len = layout.axis === "y" ? w : h;
        let black = true;
        for (let t = 0; t < len; t += 3) {
          const i = layout.axis === "y" ? (p * w + t) * 4 : (t * w + p) * 4;
          if (lum(data[i], data[i + 1], data[i + 2]) >= 8) {
            black = false;
            break;
          }
        }
        if (black) blackLines++;
      }
    }
    checks.push({ label: blackLines ? `${blackLines} black line${blackLines === 1 ? "" : "s"} in the extended area` : "No black lines in the extended area", ok: blackLines === 0 });
  }

  const inside = layout.dx >= 0 && layout.dy >= 0 && layout.dx + layout.dw <= w && layout.dy + layout.dh <= h;
  checks.push({ label: "All original content kept (nothing cropped)", ok: inside });

  let transparent = false;
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 255) { transparent = true; break; }
  checks.push({ label: "No transparent pixels", ok: !transparent });
  return checks;
}
