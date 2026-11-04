import { beforeAll, describe, expect, it } from "vitest";
import { FakeCanvas, draws, installFakeCanvas, src, type FakeCtx } from "./fakeCanvas";
import { FIT_SNAP_TOLERANCE, drawComposition, planFit, type RenderOptions } from "@/utils/canvasResizer";
import { PRESETS } from "@/utils/presets";

beforeAll(installFakeCanvas);

const base: RenderOptions = { mode: "fit", backdrop: "solid", matte: "#FFFFFF", padding: 0 };
function run(sw: number, sh: number, tw: number, th: number, opts: Partial<RenderOptions>) {
  const canvas = new FakeCanvas(tw, th);
  const ctx = canvas.ctx as FakeCtx;
  const source = src(sw, sh);
  drawComposition(ctx as unknown as CanvasRenderingContext2D, source, tw, th, { ...base, ...opts });
  return { ctx, source };
}
/** Final draw onto the target: [srcImg, sx, sy, sw, sh, dx, dy, dw, dh] */
const last = (ctx: FakeCtx) => draws(ctx).at(-1)!.args as [unknown, number, number, number, number, number, number, number, number];

describe("alpha stripping", () => {
  it.each(["fit", "fill", "stretch"] as const)("%s: paints an opaque matte over the whole canvas first", (mode) => {
    const { ctx } = run(1000, 2000, 1080, 1920, { mode, matte: "#123456" });
    expect(ctx.calls[0]).toEqual({ op: "fillRect", args: [0, 0, 1080, 1920], fillStyle: "#123456" });
    expect(ctx.globalAlpha).toBe(1);
    expect(ctx.globalCompositeOperation).toBe("source-over");
  });
});

describe("fit (letterbox)", () => {
  it("centres a narrower source with side bars and no cropping", () => {
    const { ctx, source } = run(1000, 2000, 1080, 1920, { mode: "fit" });
    const [img, sx, sy, sw, sh, dx, dy, dw, dh] = last(ctx);
    expect(img).toBe(source);
    expect([sx, sy, sw, sh]).toEqual([0, 0, 1000, 2000]); // whole source
    expect([dw, dh]).toEqual([960, 1920]);
    expect([dx, dy]).toEqual([60, 0]);
  });

  it("centres a wider source with top/bottom bars", () => {
    const [, , , , , dx, dy, dw, dh] = last(run(2000, 1000, 1080, 1920, { mode: "fit" }).ctx);
    expect([dx, dy, dw, dh]).toEqual([0, 690, 1080, 540]);
  });

  it("applies padding on the shorter side", () => {
    const [, , , , , dx, dy, dw, dh] = last(run(1080, 1920, 1080, 1920, { mode: "fit", padding: 0.1 }).ctx);
    // pad = 108px; available 864×1704 → scale 0.8 → 864×1536
    expect([dw, dh]).toEqual([864, 1536]);
    expect([dx, dy]).toEqual([108, 192]);
  });

  it("caps padding at 25%", () => {
    const a = last(run(1080, 1920, 1080, 1920, { mode: "fit", padding: 0.9 }).ctx);
    const b = last(run(1080, 1920, 1080, 1920, { mode: "fit", padding: 0.25 }).ctx);
    expect(a.slice(5)).toEqual(b.slice(5));
  });

  it("blurred backdrop: draws the backdrop, then a matte under the image so transparency lands on the matte", () => {
    const { ctx } = run(1000, 2000, 1080, 1920, { mode: "fit", backdrop: "blur", matte: "#FFFFFF" });
    const fills = ctx.calls.filter((c) => c.op === "fillRect");
    expect(fills.at(-1)).toEqual({ op: "fillRect", args: [60, 0, 960, 1920], fillStyle: "#FFFFFF" });
    expect(draws(ctx).length).toBeGreaterThanOrEqual(2); // backdrop + image
  });
});

describe("fill (crop)", () => {
  it("covers the target and crops the centre by default", () => {
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = last(run(1000, 2000, 1080, 1920, { mode: "fill" }).ctx);
    expect([dx, dy, dw, dh]).toEqual([0, 0, 1080, 1920]);
    expect(sw).toBeCloseTo(1000);
    expect(sh).toBeCloseTo(1777.78, 1);
    expect(sx).toBeCloseTo(0);
    expect(sy).toBeCloseTo((2000 - 1777.78) / 2, 1);
  });

  it("follows the smart-crop focus", () => {
    const [, , sy] = last(run(1000, 2000, 1080, 1920, { mode: "fill", focus: { x: 0.5, y: 0 } }).ctx);
    expect(sy).toBe(0);
    const [, , syEnd, , sh] = last(run(1000, 2000, 1080, 1920, { mode: "fill", focus: { x: 0.5, y: 1 } }).ctx);
    expect(syEnd + sh).toBeCloseTo(2000);
  });

  it("never crops outside the source", () => {
    for (const focus of [{ x: -5, y: -5 }, { x: 9, y: 9 }]) {
      const [, sx, sy, sw, sh] = last(run(3000, 1000, 1080, 1920, { mode: "fill", focus }).ctx);
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sx + sw).toBeLessThanOrEqual(3000 + 1e-6);
      expect(sy + sh).toBeLessThanOrEqual(1000 + 1e-6);
    }
  });

  it("crops a wide banner source to the feature graphic", () => {
    const [, sx, sy, sw, sh, , , dw, dh] = last(run(2400, 1000, 1024, 500, { mode: "fill" }).ctx);
    expect([dw, dh]).toEqual([1024, 500]);
    expect(sw / sh).toBeCloseTo(1024 / 500);
    expect(sy).toBe(0);
    expect(sx).toBeCloseTo((2400 - 2048) / 2);
  });
});

describe("stretch", () => {
  it("maps the whole source onto the whole target", () => {
    const { ctx, source } = run(1000, 1000, 1080, 1920, { mode: "stretch" });
    expect(last(ctx)).toEqual([source, 0, 0, 1000, 1000, 0, 0, 1080, 1920]);
  });
});

describe("high-quality downscale", () => {
  it("halves through intermediate canvases for large reductions", () => {
    const { ctx, source } = run(8000, 16000, 1080, 1920, { mode: "stretch" });
    const [img, , , sw] = last(ctx);
    expect(img).not.toBe(source); // drew from a stepped-down intermediate
    expect(sw / 1080).toBeLessThanOrEqual(2);
  });
  it("draws directly when the reduction is small", () => {
    const { ctx, source } = run(1320, 2868, 1080, 1920, { mode: "stretch" });
    expect(last(ctx)[0]).toBe(source);
  });
});

describe("planFit", () => {
  it("same shape → exact, nothing added or trimmed", () => {
    expect(planFit(2640, 5736, 1320, 2868)).toEqual({ strategy: "exact", trim: 0, bars: 0, axis: null });
    expect(planFit(1320, 2868, 1320, 2868).strategy).toBe("exact");
  });

  it.each([
    ["6.7 → 6.9", 1290, 2796, 1320, 2868],
    ["6.1 → 6.3", 1179, 2556, 1206, 2622],
    ["6.9 → 6.3", 1320, 2868, 1206, 2622],
    ["12.9 → 13 iPad", 2048, 2732, 2064, 2752],
  ])("%s snaps with a sub-1%% trim", (_, sw, sh, tw, th) => {
    const p = planFit(sw, sh, tw, th);
    expect(p.strategy).toBe("snap");
    expect(p.trim).toBeGreaterThan(0);
    expect(p.trim).toBeLessThanOrEqual(FIT_SNAP_TOLERANCE);
    expect(p.bars).toBe(0);
  });

  it("reports the axis that gets trimmed", () => {
    // 1290×2796 → 1320×2868: height scales more, so cover trims width.
    expect(planFit(1290, 2796, 1320, 2868).axis).toBe("x");
    // Taller-than-target source: cover trims height.
    expect(planFit(1000, 2010, 1000, 2000).axis).toBe("y");
  });

  it("real shape differences keep the whole image and add bars", () => {
    const p = planFit(1320, 2868, 1080, 1920); // tall iPhone → 9:16 Play
    expect(p.strategy).toBe("letterbox");
    expect(p.axis).toBe("x");
    expect(p.bars).toBe(1080 - Math.round(1320 * (1920 / 2868)));
    expect(planFit(1398, 2034, 2007, 2853).strategy).toBe("letterbox"); // Duo outer → inner (2.3%)
  });

  it("just over the tolerance letterboxes, just under snaps", () => {
    expect(planFit(1000, 1000 * (1 + FIT_SNAP_TOLERANCE * 0.9), 1000, 1000).strategy).toBe("snap");
    expect(planFit(1000, 1000 * (1 + FIT_SNAP_TOLERANCE * 1.2), 1000, 1000).strategy).toBe("letterbox");
  });

  it("never trims when padding is set (the user asked for space)", () => {
    const p = planFit(1290, 2796, 1320, 2868, 0.05);
    expect(p.strategy).toBe("letterbox");
    expect(p.bars).toBeGreaterThan(0);
  });
});

describe("fit never adds unnecessary space or crops", () => {
  const apple = PRESETS.filter((p) => p.store === "app_store" && p.rules.kind === "exact");

  it("every pair of accepted Apple sizes in the same device family fills the frame edge to edge", () => {
    for (const target of apple) {
      for (const source of apple.filter((p) => p.deviceClass === target.deviceClass && p.id !== target.id)) {
        if (planFit(source.portrait.w, source.portrait.h, target.portrait.w, target.portrait.h).strategy === "letterbox") continue;
        const { ctx } = run(source.portrait.w, source.portrait.h, target.portrait.w, target.portrait.h, { mode: "fit", backdrop: "blur" });
        const [, , , , , dx, dy, dw, dh] = last(ctx);
        expect([dx, dy, dw, dh]).toEqual([0, 0, target.portrait.w, target.portrait.h]);
        expect(draws(ctx)).toHaveLength(1); // no blurred backdrop drawn behind a full-bleed image
      }
    }
  });

  it("snap trims evenly from both edges and stays inside the source", () => {
    const [, sx, sy, sw, sh] = last(run(1290, 2796, 1320, 2868, { mode: "fit" }).ctx);
    expect(sy).toBe(0);
    expect(sh).toBe(2796);
    expect(sx).toBeCloseTo((1290 - sw) / 2);
    expect(1290 - sw).toBeLessThan(1290 * FIT_SNAP_TOLERANCE); // ≈3 px total
  });

  it("an exact-shape resize draws the whole source with no trim", () => {
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = last(run(2640, 5736, 1320, 2868, { mode: "fit" }).ctx);
    expect([sx, sy, sw, sh]).toEqual([0, 0, 2640, 5736]);
    expect([dx, dy, dw, dh]).toEqual([0, 0, 1320, 2868]);
  });

  it("letterbox keeps the whole source (nothing cropped)", () => {
    const [, sx, sy, sw, sh] = last(run(1320, 2868, 1080, 1920, { mode: "fit" }).ctx);
    expect([sx, sy, sw, sh]).toEqual([0, 0, 1320, 2868]);
  });
});
