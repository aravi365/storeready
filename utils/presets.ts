/**
 * Store export presets and compliance rules.
 *
 * Re-verified against the official docs on 2026-11-04:
 *  - Apple: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
 *    • 6.9" (Dynamic Island, large): 1320×2868, also accepts 1290×2796 and 1260×2736
 *    • 6.3" (Dynamic Island, medium): 1206×2622 or 1179×2556 — REQUIRED: "At least one screenshot
 *      for iPhone with Dynamic Island (medium display)" (re-verified 2026-11-05)
 *    • 6.5" (Face ID, large): 1284×2778 or 1242×2688 — fallback when no 6.9" set is provided
 *    • 13" iPad: 2064×2752 or 2048×2732 (required if the app runs on iPad)
 *    • 12.9" iPad (2nd gen): 2048×2732 — optional, scaled from 13" if missing
 *    • iPhone Duo (foldable): outer display 1398×2034, inner display 2007×2853 (either orientation).
 *      Submitting them adds an "optimized for iPhone Duo" badge to the product page; required from
 *      April 2027 for apps built with the iOS 27.1 SDK or later. (Re-verified 2026-11-05.)
 *    • .png / .jpg / .jpeg, no alpha channel or transparency, 1–10 per device size
 *  - Google Play: https://support.google.com/googleplay/android-developer/answer/9866151
 *    • Screenshots: JPEG or 24-bit PNG (no alpha), each side 320–3840 px,
 *      long side ≤ 2× short side, 2–8 per device type
 *    • Recommendation eligibility (phone): ≥4 shots at 9:16 ≥1080×1920 or 16:9 ≥1920×1080
 *    • Large screens (7"/10" tablets, Chromebook): each side 1080–7680 px, 9:16 or 16:9
 *    • Feature graphic: exactly 1024×500, JPEG or 24-bit PNG, no alpha
 *    • Android XR: 8:5 aspect ratio, recommended 3840×2400 (minimum 1920×1200), PNG or JPEG up to
 *      8 MB each, 4–8 screenshots (re-verified 2026-11-05)
 *    • Google no longer publishes a per-file limit; we keep the historical 8 MB cap as a safety margin.
 */

export type Store = "app_store" | "play_store" | "custom";
export type DeviceClass = "phone" | "tablet" | "foldable" | "xr";
export type Category = "screenshot" | "feature_graphic";
/** A language id from utils/languages.ts (App Store Connect code, e.g. "en-US", "ja", "zh-Hans"). */
export type Locale = string;
export type Orientation = "portrait" | "landscape";

export interface Size {
  w: number;
  h: number;
}

export type RuleSet =
  | { kind: "exact"; accepted: Size[] }
  | { kind: "play_phone" }
  | { kind: "play_large_screen" }
  | { kind: "play_xr" };

export interface Preset {
  id: string;
  store: Store;
  label: string;
  /** Folder name inside app-store-assets/<store>/<locale>/ */
  folder: string;
  deviceClass: DeviceClass;
  category: Category;
  /** Portrait size; landscape is the transpose unless `landscapeOnly` */
  portrait: Size;
  landscapeOnly?: boolean;
  defaultEnabled: boolean;
  rules: RuleSet;
  maxBytes?: number;
  note?: string;
  /** Shown as an amber warning in the selector */
  warning?: string;
}

export const MB = 1024 * 1024;
export const PLAY_MAX_BYTES = 8 * MB;

const t = (s: Size): Size => ({ w: s.h, h: s.w });
const both = (...sizes: Size[]): Size[] => sizes.flatMap((s) => [s, t(s)]);

export const PRESETS: Preset[] = [
  // ───────── Apple App Store ─────────
  {
    id: "as_iphone_69",
    store: "app_store",
    label: 'iPhone 6.9"',
    folder: "iphone_6.9",
    deviceClass: "phone",
    category: "screenshot",
    portrait: { w: 1320, h: 2868 },
    defaultEnabled: true,
    rules: {
      kind: "exact",
      accepted: both({ w: 1320, h: 2868 }, { w: 1290, h: 2796 }, { w: 1260, h: 2736 }),
    },
    note: "Primary iPhone set. App Store Connect scales it down for smaller iPhones.",
  },
  {
    id: "as_iphone_63",
    store: "app_store",
    label: 'iPhone 6.3"',
    folder: "iphone_6.3",
    deviceClass: "phone",
    category: "screenshot",
    portrait: { w: 1206, h: 2622 },
    defaultEnabled: true,
    rules: { kind: "exact", accepted: both({ w: 1206, h: 2622 }, { w: 1179, h: 2556 }) },
    note: "Required by App Store Connect: at least one screenshot for the medium Dynamic Island display.",
  },
  {
    id: "as_iphone_67",
    store: "app_store",
    label: 'iPhone 6.7" (alt)',
    folder: "iphone_6.7",
    deviceClass: "phone",
    category: "screenshot",
    portrait: { w: 1290, h: 2796 },
    defaultEnabled: false,
    rules: { kind: "exact", accepted: both({ w: 1290, h: 2796 }, { w: 1320, h: 2868 }) },
    note: 'Accepted in the 6.9" slot. Only needed if you upload 1290×2796 instead of 1320×2868.',
  },
  {
    id: "as_iphone_65",
    store: "app_store",
    label: 'iPhone 6.5" (fallback)',
    folder: "iphone_6.5",
    deviceClass: "phone",
    category: "screenshot",
    portrait: { w: 1284, h: 2778 },
    defaultEnabled: false,
    rules: { kind: "exact", accepted: both({ w: 1284, h: 2778 }, { w: 1242, h: 2688 }) },
    note: 'Only required when no 6.9" screenshots are provided.',
  },
  {
    id: "as_ipad_13",
    store: "app_store",
    label: 'iPad Pro 13"',
    folder: "ipad_13",
    deviceClass: "tablet",
    category: "screenshot",
    portrait: { w: 2064, h: 2752 },
    defaultEnabled: true,
    rules: { kind: "exact", accepted: both({ w: 2064, h: 2752 }, { w: 2048, h: 2732 }) },
    note: "Required if your app runs on iPad.",
  },
  {
    id: "as_ipad_129",
    store: "app_store",
    label: 'iPad Pro 12.9" (alt)',
    folder: "ipad_12.9",
    deviceClass: "tablet",
    category: "screenshot",
    portrait: { w: 2048, h: 2732 },
    defaultEnabled: false,
    rules: { kind: "exact", accepted: both({ w: 2048, h: 2732 }) },
    note: 'Optional. Apple scales 13" screenshots when this is missing.',
  },

  {
    id: "as_duo_outer",
    store: "app_store",
    label: "iPhone Duo outer",
    folder: "iphone_duo_outer",
    deviceClass: "foldable",
    category: "screenshot",
    portrait: { w: 1398, h: 2034 },
    defaultEnabled: true,
    rules: { kind: "exact", accepted: both({ w: 1398, h: 2034 }) },
    note: "Folded (cover) display. Duo screenshots add an \u201coptimized for iPhone Duo\u201d badge; required from April 2027 (iOS 27.1 SDK).",
  },
  {
    id: "as_duo_inner",
    store: "app_store",
    label: "iPhone Duo inner",
    folder: "iphone_duo_inner",
    deviceClass: "foldable",
    category: "screenshot",
    portrait: { w: 2007, h: 2853 },
    defaultEnabled: true,
    rules: { kind: "exact", accepted: both({ w: 2007, h: 2853 }) },
    note: "Unfolded (main) display.",
  },

  // ───────── Google Play ─────────
  {
    id: "gp_phone",
    store: "play_store",
    label: "Phone",
    folder: "phone",
    deviceClass: "phone",
    category: "screenshot",
    portrait: { w: 2160, h: 3840 },
    defaultEnabled: true,
    rules: { kind: "play_phone" },
    maxBytes: PLAY_MAX_BYTES,
    note: "2160×3840 (9:16): within Play's 320–3840 px limits and promo-eligible (≥1080 px).",
  },
  {
    id: "gp_tablet_10",
    store: "play_store",
    label: '10" tablet (9:16)',
    folder: "tablet_10in",
    deviceClass: "tablet",
    category: "screenshot",
    portrait: { w: 2160, h: 3840 },
    defaultEnabled: true,
    rules: { kind: "play_large_screen" },
    maxBytes: PLAY_MAX_BYTES,
    note: "Large-screen listings now require 9:16 / 16:9 with sides of 1080–7680 px.",
  },
  {
    id: "gp_tablet_7",
    store: "play_store",
    label: '7" tablet (9:16)',
    folder: "tablet_7in",
    deviceClass: "tablet",
    category: "screenshot",
    portrait: { w: 2160, h: 3840 },
    defaultEnabled: true,
    rules: { kind: "play_large_screen" },
    maxBytes: PLAY_MAX_BYTES,
  },
  {
    id: "gp_tablet_10_legacy",
    store: "play_store",
    label: '10" tablet 1600×2560 (legacy)',
    folder: "tablet_10in_16x10",
    deviceClass: "tablet",
    category: "screenshot",
    portrait: { w: 1600, h: 2560 },
    defaultEnabled: false,
    rules: { kind: "play_large_screen" },
    maxBytes: PLAY_MAX_BYTES,
    warning: "16:10 ratio. Current Play guidance asks for 9:16 / 16:9 on large screens.",
  },
  {
    id: "gp_tablet_7_legacy",
    store: "play_store",
    label: '7" tablet 1200×1920 (legacy)',
    folder: "tablet_7in_16x10",
    deviceClass: "tablet",
    category: "screenshot",
    portrait: { w: 1200, h: 1920 },
    defaultEnabled: false,
    rules: { kind: "play_large_screen" },
    maxBytes: PLAY_MAX_BYTES,
    warning: "16:10 ratio. Current Play guidance asks for 9:16 / 16:9 on large screens.",
  },
  {
    id: "gp_xr",
    store: "play_store",
    label: "Android XR",
    folder: "xr",
    deviceClass: "xr",
    category: "screenshot",
    portrait: { w: 3840, h: 2400 },
    landscapeOnly: true,
    defaultEnabled: true,
    rules: { kind: "play_xr" },
    maxBytes: PLAY_MAX_BYTES,
    note: "8:5 landscape, 4–8 per language. Use real captures from an XR headset or the Android XR emulator.",
  },
  {
    id: "gp_feature",
    store: "play_store",
    label: "Feature graphic",
    folder: "feature_graphic",
    deviceClass: "phone",
    category: "feature_graphic",
    portrait: { w: 1024, h: 500 },
    landscapeOnly: true,
    defaultEnabled: true,
    rules: { kind: "exact", accepted: [{ w: 1024, h: 500 }] },
    maxBytes: PLAY_MAX_BYTES,
    note: "Exactly 1024×500. Required to publish a Play listing.",
  },
];

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p])) as Record<
  string,
  Preset
>;

/** Google Play tablet presets (7" and 10", incl. legacy 16:10). Optional in Play Console. */
export const PLAY_TABLET_IDS = PRESETS.filter((p) => p.store === "play_store" && p.deviceClass === "tablet").map((p) => p.id);

/** Turns every Play tablet preset off, or restores the default (10" 9:16) when turning back on. */
export function setPlayTablets(presets: Set<string>, on: boolean): Set<string> {
  const next = new Set([...presets].filter((id) => !PLAY_TABLET_IDS.includes(id)));
  if (on) PRESETS.filter((p) => PLAY_TABLET_IDS.includes(p.id) && p.defaultEnabled).forEach((p) => next.add(p.id));
  return next;
}

/** A user-defined W×H output, applied to every image (any device type). */
export function customPreset(size: Size): Preset {
  const portrait = { w: Math.min(size.w, size.h), h: Math.max(size.w, size.h) };
  return {
    id: `custom_${portrait.w}x${portrait.h}`,
    store: "custom",
    label: `Custom ${portrait.w}×${portrait.h}`,
    folder: `${portrait.w}x${portrait.h}`,
    deviceClass: "phone",
    category: "screenshot",
    portrait,
    defaultEnabled: true,
    rules: { kind: "exact", accepted: [portrait, { w: portrait.h, h: portrait.w }] },
    note: "Your custom size. Keeps each image's orientation.",
  };
}

export const STORE_LABEL: Record<Store, string> = {
  app_store: "Apple App Store",
  play_store: "Google Play",
  custom: "Custom sizes",
};


export function sizeFor(preset: Preset, orientation: Orientation): Size {
  if (preset.landscapeOnly) return preset.portrait;
  return orientation === "portrait" ? preset.portrait : t(preset.portrait);
}

/** Presets that apply to an asset with the given device + category. */
export function presetsFor(
  deviceClass: DeviceClass,
  category: Category,
  enabled: Set<string>,
  stores: Set<Store>,
): Preset[] {
  return PRESETS.filter(
    (p) =>
      enabled.has(p.id) &&
      stores.has(p.store) &&
      p.category === category &&
      (category === "feature_graphic" || p.deviceClass === deviceClass),
  );
}

// ───────── Compliance ─────────

export interface ComplianceCheck {
  label: string;
  ok: boolean;
  /** "warn" = passes upload but has a caveat */
  level?: "warn";
}

export interface ComplianceResult {
  ok: boolean;
  checks: ComplianceCheck[];
}

export function checkDimensions(preset: Preset, size: Size): ComplianceCheck[] {
  const { w, h } = size;
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  switch (preset.rules.kind) {
    case "exact": {
      const ok = preset.rules.accepted.some((s) => s.w === w && s.h === h);
      return [{ label: `Exact size ${w}×${h} accepted`, ok }];
    }
    case "play_phone":
      return [
        { label: "Each side 320–3840 px", ok: short >= 320 && long <= 3840 },
        { label: "Long side ≤ 2× short side", ok: long <= 2 * short },
        {
          label: "9:16 / 16:9 ≥1080 px (promo-eligible)",
          ok: Math.abs(short / long - 9 / 16) < 0.005 && short >= 1080,
          level: "warn",
        },
      ];
    case "play_large_screen":
      return [
        { label: "Each side 1080–7680 px", ok: short >= 1080 && long <= 7680 },
        { label: "9:16 / 16:9 aspect ratio", ok: Math.abs(short / long - 9 / 16) < 0.005 },
      ];
    case "play_xr":
      return [
        { label: "8:5 aspect ratio", ok: Math.abs(long / short - 8 / 5) < 0.005 },
        { label: "≥1920×1200 (recommended 3840×2400)", ok: long >= 1920 && short >= 1200, level: "warn" },
      ];
  }
}

export function evaluate(
  preset: Preset,
  size: Size,
  opts: { bytes?: number; hasAlpha: boolean; format: "png" | "jpeg" },
): ComplianceResult {
  const checks = checkDimensions(preset, size);
  checks.push({
    label: opts.format === "png" ? "24-bit RGB PNG, no alpha" : "RGB JPEG, no alpha",
    ok: !opts.hasAlpha,
  });
  if (preset.maxBytes && opts.bytes !== undefined) {
    checks.push({
      label: `File ≤ ${(preset.maxBytes / MB).toFixed(0)} MB (${(opts.bytes / MB).toFixed(2)} MB)`,
      ok: opts.bytes <= preset.maxBytes,
    });
  }
  const ok = checks.every((c) => c.ok || c.level === "warn");
  return { ok, checks };
}
