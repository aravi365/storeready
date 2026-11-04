/**
 * App icon generator for iOS + Android, laid out for Flutter, React Native,
 * Expo, or plain native projects.
 *
 * Specs (checked 2026-11):
 *  iOS  – one 1024×1024 opaque PNG (Xcode 14+ single-size asset catalog), or the full legacy
 *         size set for older templates. No alpha: Apple rejects transparent icons. Optional
 *         iOS 18+ dark & tinted appearances (single-size catalog only).
 *  Android – legacy ic_launcher / ic_launcher_round at 48 dp; adaptive icon layers at 108 dp
 *         (keep the logo inside the 66 dp safe zone); monochrome layer for Android 13+
 *         themed icons. Densities: mdpi 1×, hdpi 1.5×, xhdpi 2×, xxhdpi 3×, xxxhdpi 4×.
 *  Google Play – 512×512 PNG, full square (Play applies the mask), ≤ 1024 KB.
 */
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { createCanvas } from "./canvasResizer";
import { encodeRgbPng } from "./pngEncoder";

export type Framework = "flutter" | "react-native" | "expo" | "native";
export type IosMode = "single" | "legacy";
export type Shape = "square" | "rounded" | "circle";

export interface IconSettings {
  framework: Framework;
  rnAppName: string;
  iosMode: IosMode;
  background: string;
  /** Logo size as a fraction of the iOS / Play canvas (1 = full bleed) */
  iosScale: number;
  /** Logo size as a fraction of the 108 dp adaptive canvas (0.61 ≈ 66 dp safe zone) */
  androidScale: number;
  monochrome: boolean;
  darkVariants: boolean;
  darkBackground: string;
}

export const SAFE_ZONE = 66 / 108;

export const DENSITIES = [
  { name: "mdpi", scale: 1 },
  { name: "hdpi", scale: 1.5 },
  { name: "xhdpi", scale: 2 },
  { name: "xxhdpi", scale: 3 },
  { name: "xxxhdpi", scale: 4 },
] as const;

interface IosEntry {
  idiom: "iphone" | "ipad" | "ios-marketing";
  pt: number;
  scale: number;
}

const IOS_LEGACY: IosEntry[] = [
  { idiom: "iphone", pt: 20, scale: 2 }, { idiom: "iphone", pt: 20, scale: 3 },
  { idiom: "iphone", pt: 29, scale: 2 }, { idiom: "iphone", pt: 29, scale: 3 },
  { idiom: "iphone", pt: 40, scale: 2 }, { idiom: "iphone", pt: 40, scale: 3 },
  { idiom: "iphone", pt: 60, scale: 2 }, { idiom: "iphone", pt: 60, scale: 3 },
  { idiom: "ipad", pt: 20, scale: 1 }, { idiom: "ipad", pt: 20, scale: 2 },
  { idiom: "ipad", pt: 29, scale: 1 }, { idiom: "ipad", pt: 29, scale: 2 },
  { idiom: "ipad", pt: 40, scale: 1 }, { idiom: "ipad", pt: 40, scale: 2 },
  { idiom: "ipad", pt: 76, scale: 1 }, { idiom: "ipad", pt: 76, scale: 2 },
  { idiom: "ipad", pt: 83.5, scale: 2 },
  { idiom: "ios-marketing", pt: 1024, scale: 1 },
];

export function layoutRoots(s: Pick<IconSettings, "framework" | "rnAppName">) {
  const app = (s.rnAppName || "MyApp").replace(/[^\w-]/g, "") || "MyApp";
  switch (s.framework) {
    case "flutter":
      return { ios: "ios/Runner/Assets.xcassets/AppIcon.appiconset", android: "android/app/src/main/res" };
    case "react-native":
      return { ios: `ios/${app}/Images.xcassets/AppIcon.appiconset`, android: "android/app/src/main/res" };
    case "expo":
      return { ios: "assets/images", android: "assets/images" };
    case "native":
      return { ios: "ios/AppIcon.appiconset", android: "android/res" };
  }
}

// ───────── Source analysis ─────────

export interface IconSource {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  hasAlpha: boolean;
  /** Average colour of the opaque border, a good automatic background */
  edgeColor: string;
}

export async function loadIconSource(file: Blob): Promise<IconSource> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use a PNG, JPEG or WebP image.");
  const bitmap = await createImageBitmap(file);
  const n = 64;
  const c = createCanvas(n, n);
  const ctx = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0, n, n);
  const { data } = ctx.getImageData(0, 0, n, n);
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) { hasAlpha = true; break; }
  let r = 0, g = 0, b = 0, k = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (x > 1 && x < n - 2 && y > 1 && y < n - 2) continue;
      const i = (y * n + x) * 4;
      if (data[i + 3] < 200) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; k++;
    }
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  const edgeColor = k ? `#${hex(r / k)}${hex(g / k)}${hex(b / k)}`.toUpperCase() : "#FFFFFF";
  return { bitmap, width: bitmap.width, height: bitmap.height, hasAlpha, edgeColor };
}

// ───────── Drawing ─────────

interface LayerOpts {
  bg: string | null;
  scale: number;
  shape: Shape;
  /** Turn every visible pixel white (Android monochrome layer) */
  mono?: boolean;
  grayscale?: boolean;
  noLogo?: boolean;
}

export function drawIcon(src: CanvasImageSource & { width: number; height: number }, size: number, o: LayerOpts) {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d", { willReadFrequently: !!o.grayscale }) as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (o.shape !== "square") {
    ctx.beginPath();
    if (o.shape === "circle") ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    else ctx.roundRect(0, 0, size, size, size * 0.18);
    ctx.clip();
  }
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, size, size);
  }
  if (!o.noLogo) {
    const box = size * o.scale;
    const k = Math.min(box / src.width, box / src.height);
    const w = src.width * k;
    const h = src.height * k;
    // Step-down for big reductions (e.g. 1024 → 20 px) to avoid aliasing.
    let cur: CanvasImageSource & { width: number; height: number } = src;
    while (cur.width / w > 2) {
      const t = createCanvas(Math.max(1, Math.round(cur.width / 2)), Math.max(1, Math.round(cur.height / 2)));
      const tctx = t.getContext("2d") as CanvasRenderingContext2D;
      tctx.imageSmoothingQuality = "high";
      tctx.drawImage(cur, 0, 0, t.width, t.height);
      cur = t as typeof cur;
    }
    if (o.mono) {
      const t = createCanvas(size, size);
      const tctx = t.getContext("2d") as CanvasRenderingContext2D;
      tctx.drawImage(cur, (size - w) / 2, (size - h) / 2, w, h);
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = "#FFFFFF";
      tctx.fillRect(0, 0, size, size);
      ctx.drawImage(t, 0, 0);
    } else {
      ctx.drawImage(cur, (size - w) / 2, (size - h) / 2, w, h);
    }
  }
  if (o.grayscale) {
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = l;
    }
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

async function toPng(canvas: ReturnType<typeof createCanvas>, opaque: boolean): Promise<Blob> {
  if (opaque) {
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return encodeRgbPng(data, canvas.width, canvas.height); // true 24-bit, no alpha
  }
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/png" });
  return new Promise((res, rej) =>
    (canvas as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error("PNG encode failed"))), "image/png"),
  );
}

// ───────── Plan ─────────

export interface IconFile {
  path: string;
  size: number;
  platform: "ios" | "android" | "store";
  /** Opaque files are written as 24-bit RGB PNG */
  opaque: boolean;
  layer: LayerOpts;
}

export function planIcons(s: IconSettings, src: Pick<IconSource, "hasAlpha">): { files: IconFile[]; texts: { path: string; text: string }[] } {
  const roots = layoutRoots(s);
  const files: IconFile[] = [];
  const texts: { path: string; text: string }[] = [];
  const iosLayer: LayerOpts = { bg: s.background, scale: s.iosScale, shape: "square" };
  const fg: LayerOpts = { bg: null, scale: s.androidScale, shape: "square" };
  const mono = s.monochrome && src.hasAlpha;
  const dark = s.darkVariants && src.hasAlpha && s.iosMode === "single";

  // Store listing icons
  files.push({ path: "store/app_store_1024.png", size: 1024, platform: "store", opaque: true, layer: iosLayer });
  files.push({ path: "store/play_store_512.png", size: 512, platform: "store", opaque: true, layer: iosLayer });

  if (s.framework === "expo") {
    files.push({ path: `${roots.ios}/icon.png`, size: 1024, platform: "ios", opaque: true, layer: iosLayer });
    files.push({ path: `${roots.android}/adaptive-icon.png`, size: 1024, platform: "android", opaque: false, layer: fg });
    if (mono) files.push({ path: `${roots.android}/monochrome-icon.png`, size: 1024, platform: "android", opaque: false, layer: { ...fg, mono: true } });
    if (dark) {
      files.push({ path: `${roots.ios}/icon-dark.png`, size: 1024, platform: "ios", opaque: true, layer: { ...iosLayer, bg: s.darkBackground } });
      files.push({ path: `${roots.ios}/icon-tinted.png`, size: 1024, platform: "ios", opaque: true, layer: { ...iosLayer, bg: "#000000", grayscale: true } });
    }
    texts.push({ path: "app.json.snippet.json", text: JSON.stringify(expoSnippet(s, mono, dark), null, 2) });
    return { files, texts };
  }

  // iOS asset catalog
  const images: Record<string, unknown>[] = [];
  if (s.iosMode === "single") {
    files.push({ path: `${roots.ios}/AppIcon-1024.png`, size: 1024, platform: "ios", opaque: true, layer: iosLayer });
    images.push({ filename: "AppIcon-1024.png", idiom: "universal", platform: "ios", size: "1024x1024" });
    if (dark) {
      files.push({ path: `${roots.ios}/AppIcon-1024-dark.png`, size: 1024, platform: "ios", opaque: true, layer: { ...iosLayer, bg: s.darkBackground } });
      files.push({ path: `${roots.ios}/AppIcon-1024-tinted.png`, size: 1024, platform: "ios", opaque: true, layer: { ...iosLayer, bg: "#000000", grayscale: true } });
      images.push({ appearances: [{ appearance: "luminosity", value: "dark" }], filename: "AppIcon-1024-dark.png", idiom: "universal", platform: "ios", size: "1024x1024" });
      images.push({ appearances: [{ appearance: "luminosity", value: "tinted" }], filename: "AppIcon-1024-tinted.png", idiom: "universal", platform: "ios", size: "1024x1024" });
    }
  } else {
    for (const e of IOS_LEGACY) {
      const px = Math.round(e.pt * e.scale);
      const filename = `Icon-App-${e.pt}x${e.pt}@${e.scale}x.png`;
      if (!files.some((f) => f.path.endsWith(`/${filename}`)))
        files.push({ path: `${roots.ios}/${filename}`, size: px, platform: "ios", opaque: true, layer: iosLayer });
      images.push({ size: `${e.pt}x${e.pt}`, idiom: e.idiom, filename, scale: `${e.scale}x` });
    }
  }
  texts.push({ path: `${roots.ios}/Contents.json`, text: JSON.stringify({ images, info: { version: 1, author: "xcode" } }, null, 2) });

  // Android resources
  for (const d of DENSITIES) {
    const dir = `${roots.android}/mipmap-${d.name}`;
    files.push({ path: `${dir}/ic_launcher.png`, size: 48 * d.scale, platform: "android", opaque: false, layer: { bg: s.background, scale: Math.min(1, (s.androidScale / SAFE_ZONE) * 0.8), shape: "rounded" } });
    files.push({ path: `${dir}/ic_launcher_round.png`, size: 48 * d.scale, platform: "android", opaque: false, layer: { bg: s.background, scale: Math.min(0.9, (s.androidScale / SAFE_ZONE) * 0.7), shape: "circle" } });
    files.push({ path: `${dir}/ic_launcher_foreground.png`, size: 108 * d.scale, platform: "android", opaque: false, layer: fg });
    if (mono) files.push({ path: `${dir}/ic_launcher_monochrome.png`, size: 108 * d.scale, platform: "android", opaque: false, layer: { ...fg, mono: true } });
  }
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>${mono ? `\n    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>` : ""}
</adaptive-icon>
`;
  texts.push({ path: `${roots.android}/mipmap-anydpi-v26/ic_launcher.xml`, text: adaptive });
  texts.push({ path: `${roots.android}/mipmap-anydpi-v26/ic_launcher_round.xml`, text: adaptive });
  texts.push({
    path: `${roots.android}/values/ic_launcher_background.xml`,
    text: `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${s.background}</color>\n</resources>\n`,
  });
  return { files, texts };
}

function expoSnippet(s: IconSettings, mono: boolean, dark: boolean) {
  return {
    expo: {
      icon: "./assets/images/icon.png",
      ios: dark
        ? { icon: { light: "./assets/images/icon.png", dark: "./assets/images/icon-dark.png", tinted: "./assets/images/icon-tinted.png" } }
        : { icon: "./assets/images/icon.png" },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/images/adaptive-icon.png",
          backgroundColor: s.background,
          ...(mono ? { monochromeImage: "./assets/images/monochrome-icon.png" } : {}),
        },
      },
    },
  };
}

function readme(s: IconSettings): string {
  const r = layoutRoots(s);
  const steps: Record<Framework, string> = {
    flutter: `1. Copy \`ios/\` and \`android/\` over your Flutter project root (replace the existing AppIcon.appiconset and mipmap-* folders).\n2. Run \`flutter clean && flutter run\`.`,
    "react-native": `1. Copy \`ios/\` and \`android/\` over your React Native project root. The iOS path assumes your app target is \`${s.rnAppName || "MyApp"}\`.\n2. Rebuild: \`npx react-native run-ios\` / \`run-android\` (or clean the build in Xcode).`,
    expo: `1. Copy \`assets/images/*\` into your project.\n2. Merge \`app.json.snippet.json\` into \`app.json\` / \`app.config.*\`.\n3. Run \`npx expo prebuild --clean\` (or rebuild with EAS).`,
    native: `1. Drag \`ios/AppIcon.appiconset\` into your Xcode asset catalog (replace AppIcon).\n2. Copy \`android/res/*\` into \`app/src/main/res/\`.`,
  };
  return `# App icons (${s.framework})

Generated by StoreShot on ${new Date().toISOString().slice(0, 10)}.

## Install
${steps[s.framework]}

## Store listing icons
- \`store/app_store_1024.png\`: 1024×1024 opaque 24-bit PNG (App Store Connect takes it from the asset catalog).
- \`store/play_store_512.png\`: 512×512 full-square PNG for the Play Console (Google applies the mask). Keep it ≤ 1024 KB.

## Notes
- iOS icons are opaque (no alpha), as Apple requires. Don't pre-round corners; iOS masks them.
- Android adaptive icon background colour: \`${s.background}\`. Foreground logo fills ${Math.round(s.androidScale * 108)} dp of the 108 dp canvas (safe zone 66 dp).
- iOS root: \`${r.ios}\` · Android root: \`${r.android}\`
`;
}

export async function exportIcons(
  src: IconSource,
  s: IconSettings,
  onProgress?: (done: number, total: number) => void,
): Promise<{ count: number; bytes: number; playBytes: number }> {
  const { files, texts } = planIcons(s, src);
  const zip = new JSZip();
  const root = zip.folder("app-icons")!;
  let playBytes = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const blob = await toPng(drawIcon(src.bitmap, f.size, f.layer), f.opaque);
    if (f.path === "store/play_store_512.png") playBytes = blob.size;
    root.file(f.path, blob, { compression: "STORE" });
    onProgress?.(i + 1, files.length + 1);
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  for (const t of texts) root.file(t.path, t.text);
  root.file("README.md", readme(s));
  const out = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  onProgress?.(files.length + 1, files.length + 1);
  saveAs(out, `app-icons-${s.framework}-${new Date().toISOString().slice(0, 10)}.zip`);
  return { count: files.length + texts.length + 1, bytes: out.size, playBytes };
}
