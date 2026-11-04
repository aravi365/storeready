import { describe, expect, it } from "vitest";
import { crc32, inflateSync } from "node:zlib";
import { encodeRgbPng, pngHasAlpha } from "@/utils/pngEncoder";

interface Chunk { type: string; data: Buffer; crcOk: boolean }

function parse(buf: Buffer) {
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks: Chunk[] = [];
  let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.subarray(o + 4, o + 8).toString("latin1");
    const data = buf.subarray(o + 8, o + 8 + len);
    const crc = buf.readUInt32BE(o + 8 + len);
    chunks.push({ type, data, crcOk: crc32(buf.subarray(o + 4, o + 8 + len)) === crc });
    o += 12 + len;
  }
  return chunks;
}

/** Reverse PNG scanline filters → raw RGB rows. */
function unfilter(raw: Buffer, w: number, h: number) {
  const stride = w * 3;
  const out = Buffer.alloc(stride * h);
  const filters = new Set<number>();
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    filters.add(f);
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= 3 ? out[y * stride + i - 3] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= 3 && y > 0 ? out[(y - 1) * stride + i - 3] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * stride + i] = (x + pred) & 0xff;
    }
  }
  return { rgb: out, filters };
}

function image(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(fn(x, y), (y * w + x) * 4);
  return px;
}

async function roundTrip(w: number, h: number, px: Uint8ClampedArray) {
  const blob = await encodeRgbPng(px, w, h);
  const buf = Buffer.from(await blob.arrayBuffer());
  const chunks = parse(buf);
  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  return { blob, chunks, ...unfilter(inflateSync(idat), w, h) };
}

describe("encodeRgbPng", () => {
  it("writes a valid PNG: IHDR (RGB, 8-bit), sRGB, IDAT, IEND with correct CRCs", async () => {
    const { blob, chunks } = await roundTrip(4, 3, image(4, 3, () => [10, 20, 30, 255]));
    expect(blob.type).toBe("image/png");
    expect(chunks.map((c) => c.type)).toEqual(["IHDR", "sRGB", "IDAT", "IEND"]);
    expect(chunks.every((c) => c.crcOk)).toBe(true);
    const ihdr = chunks[0].data;
    expect(ihdr.readUInt32BE(0)).toBe(4);
    expect(ihdr.readUInt32BE(4)).toBe(3);
    expect([...ihdr.subarray(8)]).toEqual([8, 2, 0, 0, 0]); // bit depth 8, colour type 2 (RGB), no interlace
    expect(chunks.some((c) => c.type === "tRNS")).toBe(false);
  });

  it("round-trips pixels exactly and drops alpha", async () => {
    const w = 37, h = 23;
    const px = image(w, h, (x, y) => [(x * 7) & 255, (y * 11) & 255, (x * y) & 255, (x + y) % 2 ? 255 : 0]);
    const { rgb } = await roundTrip(w, h, px);
    for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
      expect([rgb[j], rgb[j + 1], rgb[j + 2]]).toEqual([px[i], px[i + 1], px[i + 2]]);
    }
  });

  it("uses several filter types on mixed content and still decodes", async () => {
    const w = 64, h = 64;
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) & 255);
    const px = image(w, h, (x, y) => (y < 16 ? [0, 0, 0, 255] : y < 32 ? [x * 4, x * 4, x * 4, 255] : y < 48 ? [y * 4, 0, 0, 255] : [rand(), rand(), rand(), 255]));
    const { rgb, filters } = await roundTrip(w, h, px);
    expect(filters.size).toBeGreaterThan(1);
    expect(rgb[(63 * w + 63) * 3]).toBe(px[(63 * w + 63) * 4]);
  });

  it("handles a 1×1 image", async () => {
    const { rgb } = await roundTrip(1, 1, new Uint8ClampedArray([255, 128, 1, 255]));
    expect([...rgb]).toEqual([255, 128, 1]);
  });
});

describe("pngHasAlpha", () => {
  const header = (colourType: number) => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    b[24] = 8;
    b[25] = colourType;
    return new Blob([b]);
  };
  it("reads the colour type", async () => {
    expect(await pngHasAlpha(header(2))).toBe(false); // RGB
    expect(await pngHasAlpha(header(6))).toBe(true); // RGBA
    expect(await pngHasAlpha(header(4))).toBe(true); // grey + alpha
  });
  it("is false for our own encoder's output", async () => {
    expect(await pngHasAlpha(await encodeRgbPng(new Uint8ClampedArray(16), 2, 2))).toBe(false);
  });
});
