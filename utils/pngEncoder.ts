/**
 * Minimal 24-bit RGB PNG encoder (colour type 2, 8 bits/channel, no alpha).
 *
 * Why: `canvas.toBlob("image/png")` always writes an RGBA PNG (colour type 6), even
 * when every pixel is opaque. App Store Connect rejects any PNG that *has* an alpha
 * channel, so we re-encode the flattened pixels ourselves.
 *
 * Uses the native CompressionStream("deflate") (zlib-wrapped, exactly what IDAT needs),
 * adaptive per-row filtering, and an sRGB chunk to declare the colour profile.
 * Works on the main thread and inside Web Workers.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, crc = 0xffffffff): number {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return crc;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(data, crc32(out.subarray(4, 8))) ^ 0xffffffff;
  view.setUint32(8 + data.length, crc >>> 0);
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** RGBA → filtered RGB scanlines (one filter-type byte per row). */
function filterRows(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const stride = width * 3;
  const out = new Uint8Array((stride + 1) * height);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  const candidates = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride));

  for (let y = 0; y < height; y++) {
    // Drop alpha: pixels were already composited over an opaque matte.
    for (let x = 0, si = y * width * 4, di = 0; x < width; x++, si += 4, di += 3) {
      cur[di] = rgba[si];
      cur[di + 1] = rgba[si + 1];
      cur[di + 2] = rgba[si + 2];
    }

    // Adaptive filtering — choose the filter with the smallest sum of absolute values.
    let best = 0;
    let bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      const row = candidates[f];
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 3 ? cur[i - 3] : 0;
        const b = prev[i];
        const c = i >= 3 ? prev[i - 3] : 0;
        const x = cur[i];
        let v: number;
        switch (f) {
          case 0: v = x; break;
          case 1: v = x - a; break;
          case 2: v = x - b; break;
          case 3: v = x - ((a + b) >> 1); break;
          default: v = x - paeth(a, b, c);
        }
        v &= 0xff;
        row[i] = v;
        score += v < 128 ? v : 256 - v;
        if (score >= bestScore) break;
      }
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    // Re-run the winning filter fully (early-exit may have left it partial).
    const row = candidates[best];
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? cur[i - 3] : 0;
      const b = prev[i];
      const c = i >= 3 ? prev[i - 3] : 0;
      const x = cur[i];
      switch (best) {
        case 0: row[i] = x; break;
        case 1: row[i] = x - a; break;
        case 2: row[i] = x - b; break;
        case 3: row[i] = x - ((a + b) >> 1); break;
        default: row[i] = x - paeth(a, b, c);
      }
    }
    const offset = y * (stride + 1);
    out[offset] = best;
    out.set(row, offset + 1);
    [prev, cur] = [cur, prev];
  }
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeRgbPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Blob> {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB (no alpha)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // no interlace

  const srgb = new Uint8Array([0]); // rendering intent: perceptual
  const idat = await deflate(filterRows(rgba, width, height));

  return new Blob(
    [
      signature,
      chunk("IHDR", ihdr),
      chunk("sRGB", srgb),
      chunk("IDAT", idat),
      chunk("IEND", new Uint8Array(0)),
    ] as BlobPart[],
    { type: "image/png" },
  );
}

/** Reads the PNG header to confirm colour type — used for self-verification in the UI. */
export async function pngHasAlpha(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 26).arrayBuffer());
  const colourType = head[25];
  return colourType === 4 || colourType === 6;
}
