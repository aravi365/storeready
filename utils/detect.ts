/**
 * Auto-detection: works out what an uploaded image is from its pixel size
 * (exact device resolutions first, then aspect ratio), its file name, and its
 * byte size, and recommends device / category / orientation / locale.
 */
import type { Category, DeviceClass, Locale, Orientation, Size } from "./presets";
import { PLAY_MAX_BYTES } from "./presets";

export type DetectSource = "exact" | "ratio" | "filename";
export type Confidence = "high" | "medium" | "low";

export interface Detection {
  /** Human label, e.g. 'iPhone 6.9" (16/17 Pro Max)' */
  label: string;
  source: DetectSource;
  confidence: Confidence;
  deviceClass: DeviceClass;
  category: Category;
  orientation: Orientation;
  locale: Locale;
  aspect: string;
  /** Size-related findings shown under the badge */
  notes: { level: "info" | "warn"; text: string }[];
}

interface KnownSize {
  w: number; // portrait width (short side)
  h: number; // portrait height (long side)
  label: string;
  deviceClass: DeviceClass;
  category?: Category;
}

/** Native screenshot resolutions (portrait). Matches either orientation. */
const KNOWN: KnownSize[] = [
  // iPhone
  { w: 1320, h: 2868, label: 'iPhone 6.9" (16/17 Pro Max)', deviceClass: "phone" },
  { w: 1290, h: 2796, label: 'iPhone 6.7" (14 Pro Max – 16 Plus)', deviceClass: "phone" },
  { w: 1260, h: 2736, label: "iPhone Air", deviceClass: "phone" },
  { w: 1284, h: 2778, label: 'iPhone 6.5" (12/13 Pro Max)', deviceClass: "phone" },
  { w: 1242, h: 2688, label: 'iPhone 6.5" (XS Max / 11 Pro Max)', deviceClass: "phone" },
  { w: 1206, h: 2622, label: 'iPhone 6.3" (16/17 Pro)', deviceClass: "phone" },
  { w: 1179, h: 2556, label: 'iPhone 6.1" (14 Pro – 16)', deviceClass: "phone" },
  { w: 1170, h: 2532, label: 'iPhone 6.1" (12 – 14)', deviceClass: "phone" },
  { w: 1125, h: 2436, label: 'iPhone 5.8" (X / XS / 11 Pro)', deviceClass: "phone" },
  { w: 1080, h: 2340, label: "iPhone mini / Android 19.5:9", deviceClass: "phone" },
  { w: 828, h: 1792, label: 'iPhone 6.1" (XR / 11)', deviceClass: "phone" },
  { w: 1242, h: 2208, label: 'iPhone 5.5" (Plus)', deviceClass: "phone" },
  { w: 750, h: 1334, label: 'iPhone 4.7" (SE / 8)', deviceClass: "phone" },
  // iPad
  { w: 2064, h: 2752, label: 'iPad Pro 13" (M4)', deviceClass: "tablet" },
  { w: 2048, h: 2732, label: 'iPad Pro 12.9"', deviceClass: "tablet" },
  { w: 1668, h: 2420, label: 'iPad Pro 11" (M4)', deviceClass: "tablet" },
  { w: 1668, h: 2388, label: 'iPad Pro 11"', deviceClass: "tablet" },
  { w: 1640, h: 2360, label: 'iPad Air / iPad 10.9"', deviceClass: "tablet" },
  { w: 1620, h: 2160, label: 'iPad 10.2"', deviceClass: "tablet" },
  { w: 1488, h: 2266, label: 'iPad mini 8.3"', deviceClass: "tablet" },
  { w: 1536, h: 2048, label: 'iPad 9.7"', deviceClass: "tablet" },
  // Android phones
  { w: 1080, h: 1920, label: "Android phone 16:9 (FHD)", deviceClass: "phone" },
  { w: 1080, h: 2400, label: "Android phone 20:9 (FHD+)", deviceClass: "phone" },
  { w: 1080, h: 2220, label: "Android phone 18.5:9", deviceClass: "phone" },
  { w: 1440, h: 3200, label: "Android phone 20:9 (QHD+)", deviceClass: "phone" },
  { w: 1440, h: 3120, label: "Android phone 19.5:9 (QHD+)", deviceClass: "phone" },
  { w: 1440, h: 2560, label: "Android 16:9 (QHD)", deviceClass: "phone" },
  // Android tablets
  { w: 1600, h: 2560, label: 'Android 10" tablet (16:10)', deviceClass: "tablet" },
  { w: 1200, h: 1920, label: 'Android 7" tablet (16:10)', deviceClass: "tablet" },
  { w: 1800, h: 2880, label: "Android tablet 16:10 (2.8K)", deviceClass: "tablet" },
  { w: 1752, h: 2800, label: "Galaxy Tab S9", deviceClass: "tablet" },
  // Play feature graphic (landscape-only, stored as w>h)
  { w: 1024, h: 500, label: "Play feature graphic", deviceClass: "phone", category: "feature_graphic" },
];

function gcdRatio(w: number, h: number): string {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(w, h);
  const a = w / d;
  const b = h / d;
  if (a <= 50 && b <= 50) return `${a}:${b}`;
  // Fall back to common named ratios
  const r = Math.max(w, h) / Math.min(w, h);
  const named: [number, string][] = [
    [16 / 9, "16:9"], [19.5 / 9, "19.5:9"], [20 / 9, "20:9"], [18.5 / 9, "18.5:9"],
    [4 / 3, "4:3"], [16 / 10, "16:10"], [1024 / 500, "2.05:1"], [2868 / 1320, "19.5:9"],
  ];
  const [, name] = named.reduce((best, n) => (Math.abs(n[0] - r) < Math.abs(best[0] - r) ? n : best));
  const pretty = `≈${name}`;
  return w > h ? pretty : pretty.replace(/(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)/, "$2:$1");
}

function detectLocale(name: string): Locale {
  const lower = name.toLowerCase();
  return /(^|[^a-z])(th|thai|th-th|th_th)([^a-z]|$)|[฀-๿]/.test(lower) ? "th" : "en";
}

export function detectAsset(name: string, w: number, h: number, bytes: number): Detection {
  const lower = name.toLowerCase();
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  const ratio = short / long;
  const orientation: Orientation = w > h ? "landscape" : "portrait";
  const locale = detectLocale(name);
  const aspect = gcdRatio(w, h);
  const notes: Detection["notes"] = [];

  // Byte-size findings
  if (bytes > PLAY_MAX_BYTES) {
    notes.push({
      level: "info",
      text: `Source is ${(bytes / 1048576).toFixed(1)} MB (over Play's 8 MB). Outputs are re-encoded and size-checked.`,
    });
  }
  const bpp = bytes / (w * h);
  if (bpp < 0.12 && /\.jpe?g$/i.test(name)) {
    notes.push({ level: "warn", text: "Heavily compressed JPEG. JPEG artefacts may show in the outputs." });
  }

  let result: Omit<Detection, "notes" | "locale" | "aspect" | "orientation"> | undefined;

  // 1. Exact device resolution
  const exact = KNOWN.find(
    (k) => (k.category === "feature_graphic" ? w === k.w && h === k.h : short === k.w && long === k.h),
  );
  if (exact) {
    result = {
      label: exact.label,
      source: "exact",
      confidence: "high",
      deviceClass: exact.deviceClass,
      category: exact.category ?? "screenshot",
    };
  }

  // 2. File-name hints
  const nameFeature = /feature|banner|graphic|promo_?header/.test(lower);
  const nameTablet = /ipad|tablet|(^|[^a-z])tab([^a-z]|$)/.test(lower);
  const namePhone = /iphone|phone|mobile|android/.test(lower);

  if (!result) {
    // 3. Aspect ratio heuristics
    let deviceClass: DeviceClass;
    let category: Category = "screenshot";
    let label: string;
    let confidence: Confidence = "medium";

    if (w > h && Math.abs(w / h - 1024 / 500) < 0.15) {
      category = "feature_graphic";
      deviceClass = "phone";
      label = "Feature graphic (≈2:1 landscape)";
    } else if (ratio <= 0.5) {
      deviceClass = "phone";
      label = "Modern phone (tall, ≈19.5–20:9)";
    } else if (Math.abs(ratio - 9 / 16) < 0.02) {
      deviceClass = "phone";
      label = "16:9 phone";
    } else if (ratio >= 0.68) {
      deviceClass = "tablet";
      label = "iPad (≈3:4)";
    } else if (Math.abs(ratio - 0.625) < 0.02) {
      deviceClass = "tablet";
      label = "Android tablet (16:10)";
    } else {
      deviceClass = ratio > 0.6 ? "tablet" : "phone";
      label = deviceClass === "tablet" ? "Tablet (unusual ratio)" : "Phone (unusual ratio)";
      confidence = "low";
    }

    if (nameFeature && category !== "feature_graphic") {
      category = "feature_graphic";
      label = "Feature graphic (from file name)";
    } else if (nameTablet && deviceClass !== "tablet") {
      deviceClass = "tablet";
      label = "Tablet (from file name)";
    } else if (namePhone && deviceClass !== "phone" && category === "screenshot") {
      deviceClass = "phone";
      label = "Phone (from file name)";
    }
    const fromName = label.includes("file name");
    result = { label, source: fromName ? "filename" : "ratio", confidence: fromName ? "medium" : confidence, deviceClass, category };
  }

  // Resolution findings
  if (result.category === "screenshot") {
    const minLong = result.deviceClass === "tablet" ? 2752 : 2868; // largest Apple target
    if (long < minLong * 0.75) {
      notes.push({
        level: "warn",
        text: `Low resolution: Apple targets need ${(minLong / long).toFixed(2)}× upscaling, so outputs may look soft.`,
      });
    }
  }
  if (short < 320) notes.push({ level: "warn", text: "Below Google Play's 320 px minimum side." });

  return { ...result, orientation, locale, aspect, notes };
}

/** Scale factor needed to reach a target (>1 = upscale). Uses fit/fill semantics. */
export function scaleFactor(src: Size, target: Size, mode: "fit" | "fill" | "stretch"): number {
  const sx = target.w / src.w;
  const sy = target.h / src.h;
  return mode === "fill" ? Math.max(sx, sy) : mode === "fit" ? Math.min(sx, sy) : Math.max(sx, sy);
}
