/** Minimal OffscreenCanvas stand-in that records draw calls, for geometry tests in Node. */
export interface DrawCall { op: string; args: unknown[]; fillStyle?: string }

export class FakeCtx {
  calls: DrawCall[] = [];
  fillStyle = "#000";
  globalAlpha = 1;
  globalCompositeOperation = "source-over";
  imageSmoothingEnabled = true;
  imageSmoothingQuality = "low";
  constructor(public canvas: FakeCanvas) {}
  fillRect(...args: number[]) { this.calls.push({ op: "fillRect", args, fillStyle: this.fillStyle }); }
  drawImage(...args: unknown[]) { this.calls.push({ op: "drawImage", args }); }
  getImageData(_x: number, _y: number, w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4).fill(255) }; }
  beginPath() {}
  roundRect() {}
  arc() {}
  clip() {}
  putImageData() {}
}

export class FakeCanvas {
  ctx: FakeCtx;
  constructor(public width: number, public height: number) { this.ctx = new FakeCtx(this); }
  getContext() { return this.ctx; }
}

export function installFakeCanvas() {
  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = FakeCanvas;
}

export const src = (width: number, height: number) => ({ width, height }) as unknown as CanvasImageSource & { width: number; height: number };
export const draws = (ctx: FakeCtx) => ctx.calls.filter((c) => c.op === "drawImage");
