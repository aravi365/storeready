import { describe, expect, it } from "vitest";
import {
  FEATHER_RATIO,
  checkExtension,
  chooseSides,
  edgeLine,
  edgeParams,
  edgeScore,
  featherFor,
  fitSize,
  gaussian1d,
  layoutFor,
  type Pixels,
} from "@/utils/edgeExtend";

/** Builds an RGBA image from a per-pixel function. */
function img(w: number, h: number, f: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { data, width: w, height: h };
}
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) % 256);

describe("fitSize: fit on one axis, never crop", () => {
  it("iPad 3:4 → 2160×3840: fits width, extends top/bottom", () => {
    expect(fitSize(2064, 2752, 2160, 3840)).toMatchObject({ dw: 2160, dh: 2880, axis: "y" });
  });
  it("tall iPhone → 9:16: fits height, extends left/right", () => {
    const f = fitSize(1320, 2868, 2160, 3840);
    expect(f).toMatchObject({ dh: 3840, axis: "x" });
    expect(f.dw).toBe(Math.round(1320 * (3840 / 2868)));
  });
  it("same shape needs no extension", () => {
    expect(fitSize(1080, 1920, 2160, 3840).axis).toBeNull();
  });
  it("snaps the fitted axis to the exact target (no hairline gap)", () => {
    const f = fitSize(1290, 2796, 1320, 2868);
    expect(f.dw === 1320 || f.dh === 2868).toBe(true);
  });
});

describe("choosing the side to extend", () => {
  const plainTopBusyBottom = img(200, 400, (x, y) => (y < 200 ? [255, 255, 255] : [noise(), noise(), noise()]));

  it("extends the plain edge, even when it's white and the busy edge is darker", () => {
    expect(chooseSides(plainTopBusyBottom, "y").sides).toEqual(["top"]);
  });
  it("extends the bottom when that's the plain one", () => {
    const p = img(200, 400, (x, y) => (y >= 200 ? [20, 20, 30] : [noise(), noise(), noise()]));
    expect(chooseSides(p, "y").sides).toEqual(["bottom"]);
  });
  it("splits between both edges when both are plain and alike", () => {
    expect(chooseSides(img(100, 300, () => [240, 240, 245]), "y").sides).toEqual(["top", "bottom"]);
  });
  it("both plain but different colours (light background vs dark tab bar): extends the top only", () => {
    const p = img(200, 400, (x, y) => (y < 340 ? [238, 242, 255] : [17, 24, 39]));
    expect(chooseSides(p, "y").sides).toEqual(["top"]);
  });
  it("uses the less busy edge when both are busy", () => {
    const p = img(200, 400, (x, y) => (y < 200 ? [noise() / 4 + 100, 100, 100] : [noise(), noise(), noise()]));
    expect(chooseSides(p, "y").sides).toEqual(["top"]);
  });
  it("works on the left/right axis", () => {
    const p = img(400, 200, (x) => (x < 200 ? [noise(), noise(), noise()] : [200, 220, 240]));
    expect(chooseSides(p, "x").sides).toEqual(["right"]);
  });
  it("honours an override, and ignores one for the other axis", () => {
    expect(chooseSides(plainTopBusyBottom, "y", "bottom").sides).toEqual(["bottom"]);
    expect(chooseSides(plainTopBusyBottom, "y", "top-bottom").sides).toEqual(["top", "bottom"]);
    expect(chooseSides(plainTopBusyBottom, "y", "left").sides).toEqual(["top"]); // wrong axis → auto
  });
  it("reports texture and luminance", () => {
    const s = edgeScore(img(50, 200, () => [128, 128, 128]), "top");
    expect(s.std).toBeCloseTo(0);
    expect(s.mean).toBeCloseTo(128);
  });
});

describe("edge line (the fill)", () => {
  it("averages only the outermost rows and keeps horizontal variation like gradients", () => {
    // Top 6 rows: red → blue gradient. Row 6+: black content that must not leak into the fill.
    const p = img(100, 100, (x, y) => (y < 6 ? [255 - x * 2.55, 0, x * 2.55] : [0, 0, 0]));
    const line = edgeLine(p, "top", 6, 0);
    expect(line[0]).toBeCloseTo(255, 0); // red at the left
    expect(line[99 * 3 + 2]).toBeCloseTo(252, 0); // blue at the right
    expect(line[50 * 3 + 1]).toBe(0); // no black content mixed in
  });
  it("reads the bottom and side edges from the outside in", () => {
    const p = img(20, 20, (x, y) => (y === 19 ? [10, 20, 30] : x === 19 ? [200, 0, 0] : [0, 0, 0]));
    expect([...edgeLine(p, "bottom", 1, 0).slice(0, 3)]).toEqual([10, 20, 30]);
    expect(edgeLine(p, "right", 1, 0)[0]).toBe(200);
  });
  it("blur keeps flat colours flat and softens steps", () => {
    const flat = new Float32Array(30).fill(100);
    expect([...gaussian1d(flat, 3, 6)].every((v) => Math.abs(v - 100) < 1e-3)).toBe(true);
    const step = new Float32Array(60 * 3).map((_, i) => (i < 90 ? 0 : 255));
    const out = gaussian1d(step, 3, 6);
    expect(out[29 * 3]).toBeGreaterThan(0);
    expect(out[30 * 3]).toBeLessThan(255);
  });
});

describe("layout and feather", () => {
  it("extending the top pushes the screenshot to the bottom", () => {
    const l = layoutFor(2064, 2752, 2160, 3840, ["top"]);
    expect(l).toMatchObject({ axis: "y", dx: 0, dy: 960, dh: 2880, band: 960 });
    expect(l.joins).toEqual([{ axis: "y", pos: 960, side: "top" }]);
  });
  it("extending the bottom keeps it at the top", () => {
    const l = layoutFor(2064, 2752, 2160, 3840, ["bottom"]);
    expect(l.dy).toBe(0);
    expect(l.joins).toEqual([{ axis: "y", pos: 2880, side: "bottom" }]);
  });
  it("both sides centre it with two joins", () => {
    const l = layoutFor(2064, 2752, 2160, 3840, ["top", "bottom"]);
    expect(l.dy).toBe(480);
    expect(l.joins.map((j) => j.pos)).toEqual([480, 3360]);
  });
  it("feather is ~4% of the long side (150 px at 3840)", () => {
    expect(Math.round(FEATHER_RATIO * 3840)).toBe(150);
    expect(layoutFor(2064, 2752, 2160, 3840, ["top"]).feather).toBe(150);
  });
  it("feather never exceeds what a small band allows, so content isn't faded", () => {
    expect(featherFor(1320, 2868, 3, 2868)).toBeLessThanOrEqual(7);
    expect(featherFor(1000, 1000, 500, 30)).toBe(10); // ≤ a third of the image
  });
  it("same shape: no band, no joins", () => {
    expect(layoutFor(1080, 1920, 2160, 3840, ["top"])).toMatchObject({ axis: null, band: 0, joins: [] });
  });
});

describe("quality checks", () => {
  const layout = layoutFor(200, 300, 200, 400, ["top"]); // band 100 at the top, join at y=100

  it("passes a seamless, opaque result", () => {
    const out = img(200, 400, () => [230, 235, 240]);
    expect(checkExtension(out, layout, { top: 235 }).every((c) => c.ok)).toBe(true);
  });
  it("flags a visible seam", () => {
    const out = img(200, 400, (x, y) => (y < 100 ? [255, 255, 255] : [200, 200, 200]));
    const seam = checkExtension(out, layout, { top: 200 }).find((c) => c.label.startsWith("Seam"))!;
    expect(seam.ok).toBe(false);
  });
  it("flags black lines in the band, unless the source edge was black", () => {
    const out = img(200, 400, (x, y) => (y < 10 ? [0, 0, 0] : [120, 120, 120]));
    expect(checkExtension(out, layout, { top: 120 }).find((c) => c.label.includes("black"))!.ok).toBe(false);
    expect(checkExtension(out, layout, { top: 2 }).find((c) => c.label.includes("black"))!.ok).toBe(true);
  });
  it("flags transparency", () => {
    const out = img(200, 400, () => [120, 120, 120]);
    out.data[3] = 0;
    expect(checkExtension(out, layout, {}).find((c) => c.label.includes("transparent"))!.ok).toBe(false);
  });
  it("confirms all content is inside the canvas", () => {
    const out = img(200, 400, () => [120, 120, 120]);
    expect(checkExtension(out, layout, {}).find((c) => c.label.includes("nothing cropped"))!.ok).toBe(true);
    expect(checkExtension(out, { ...layout, dy: 150 }, {}).find((c) => c.label.includes("nothing cropped"))!.ok).toBe(false);
  });
});

describe("scale-independent decisions (preview and export agree)", () => {
  it("scales strip depth, edge rows and blur with the output size", () => {
    expect(edgeParams(3840)).toEqual({ depth: 60, rows: 6, blur: 6 });
    expect(edgeParams(1920)).toEqual({ depth: 30, rows: 3, blur: 3 });
    expect(edgeParams(400).depth).toBe(6);
  });

  it("the same image picks the same side at full size and at preview size", () => {
    // Top: plain background with a little status-bar text near the top. Bottom: a dark tab bar
    // whose icons sit just above the last strip at full size.
    const make = (w: number, h: number) =>
      img(w, h, (x, y) => {
        const fy = y / h;
        if (fy > 0.93) return fy > 0.955 && fy < 0.97 && x % Math.round(w / 5) < w / 50 ? [255, 255, 255] : [17, 24, 39];
        if (fy > 0.015 && fy < 0.03 && x < w * 0.1) return [30, 30, 30];
        return [238, 242, 255];
      });
    const full = make(2160, 2880);
    const small = make(270, 360);
    const a = chooseSides(full, "y", "auto", edgeParams(3840).depth).sides;
    const b = chooseSides(small, "y", "auto", edgeParams(480).depth).sides;
    expect(b).toEqual(a);
  });
});
