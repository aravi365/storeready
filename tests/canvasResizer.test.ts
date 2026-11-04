import { beforeAll, describe, expect, it } from "vitest";
import { FakeCanvas, draws, installFakeCanvas, src, type FakeCtx } from "./fakeCanvas";
import { drawComposition, type RenderOptions } from "@/utils/canvasResizer";

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
