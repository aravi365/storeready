/**
 * Store-readiness checklist: checks the planned export against each store's upload
 * rules, per language, before you download. Pure, so it's unit-tested.
 *
 * Rules (from the pages cited in presets.ts, checked 2026-11):
 *  Apple App Store Connect
 *   • Required: at least one screenshot for iPhone with Dynamic Island (medium display), 6.3"
 *   • 1–10 screenshots per display size (6.9" and its accepted 6.7" size share one slot)
 *   • iPad 13" is required if the app runs on iPad (we can only infer that from tablet uploads)
 *   • iPhone Duo is optional until April 2027 (iOS 27.1 SDK)
 *  Google Play Console
 *   • At least 2 screenshots to publish; at most 8 per device type
 *   • Exactly one feature graphic (1024×500) is required to publish
 *   • Large screens (tablets): at least 4 screenshots
 *   • Promotion eligibility: at least 4 phone screenshots at 9:16 / 16:9, ≥1080 px
 */
import type { Job, OutputState } from "./jobs";
import { checkDimensions, type Locale, type Store } from "./presets";

export type Level = "error" | "warning" | "info";

export interface ReadinessItem {
  id: string;
  level: Level;
  store: Store | "files";
  locale?: Locale;
  title: string;
  detail?: string;
  /** Preset to enable to fix it, when that's the fix */
  fixPreset?: string;
}

export interface ReadinessReport {
  items: ReadinessItem[];
  errors: number;
  warnings: number;
  /** Store/locale pairs that were checked, e.g. "app_store/en" */
  checked: string[];
  ready: boolean;
}

export const LIMITS = {
  appleMaxPerSize: 10,
  playMinTotal: 2,
  playMaxPerType: 8,
  playLargeScreenMin: 4,
  playPromoMin: 4,
} as const;

/** App Store Connect counts accepted alternative sizes in the same slot. */
const APPLE_SLOT: Record<string, { slot: string; name: string }> = {
  as_iphone_69: { slot: "iphone_large", name: 'iPhone 6.9"' },
  as_iphone_67: { slot: "iphone_large", name: 'iPhone 6.9"' },
  as_iphone_65: { slot: "iphone_65", name: 'iPhone 6.5"' },
  as_iphone_63: { slot: "iphone_medium", name: 'iPhone 6.3"' },
  as_ipad_13: { slot: "ipad_13", name: 'iPad 13"' },
  as_ipad_129: { slot: "ipad_129", name: 'iPad 12.9"' },
  as_duo_outer: { slot: "duo_outer", name: "iPhone Duo outer" },
  as_duo_inner: { slot: "duo_inner", name: "iPhone Duo inner" },
};

const PLAY_TYPE = (presetId: string) =>
  presetId === "gp_feature" ? "feature" : presetId === "gp_phone" ? "phone" : presetId.startsWith("gp_tablet_7") ? "tablet_7" : "tablet_10";

const LOCALE_NAME: Record<Locale, string> = { en: "English", th: "Thai" };

export function checkReadiness(
  jobs: Job[],
  outputOf: (job: Job) => Pick<OutputState, "status" | "compliance"> | undefined,
  opts: { hasTabletSources?: Partial<Record<Locale, boolean>> } = {},
): ReadinessReport {
  const items: ReadinessItem[] = [];
  const add = (i: ReadinessItem) => items.push(i);
  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    const key = `${j.preset.store}/${j.locale}`;
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }

  // A language is checked for a store when it has at least one output for that store.
  const locales = [...new Set(jobs.map((j) => j.locale))];
  for (const locale of locales) {
    const L = LOCALE_NAME[locale];

    // ─── Apple ───
    const apple = groups.get(`app_store/${locale}`) ?? [];
    if (apple.length) {
      const bySlot = new Map<string, number>();
      for (const j of apple) {
        const s = APPLE_SLOT[j.preset.id];
        if (s) bySlot.set(s.slot, (bySlot.get(s.slot) ?? 0) + 1);
      }
      const phoneOutputs = apple.some((j) => j.preset.deviceClass === "phone");
      if (!bySlot.get("iphone_medium")) {
        add({
          id: `apple-${locale}-medium`,
          level: phoneOutputs ? "error" : "warning",
          store: "app_store",
          locale,
          title: `${L}: no iPhone 6.3″ screenshots`,
          detail: phoneOutputs
            ? "App Store Connect requires at least one screenshot for the medium Dynamic Island iPhone (1206×2622 or 1179×2556)."
            : "Required for any app that runs on iPhone: at least one 1206×2622 or 1179×2556 screenshot.",
          fixPreset: "as_iphone_63",
        });
      }
      for (const [slot, count] of bySlot) {
        if (count > LIMITS.appleMaxPerSize) {
          const name = Object.values(APPLE_SLOT).find((s) => s.slot === slot)!.name;
          add({
            id: `apple-${locale}-${slot}-max`,
            level: "error",
            store: "app_store",
            locale,
            title: `${L}: ${count} ${name} screenshots (max ${LIMITS.appleMaxPerSize})`,
            detail: `App Store Connect accepts up to ${LIMITS.appleMaxPerSize} per display size. Remove ${count - LIMITS.appleMaxPerSize}.`,
          });
        }
      }
      if (opts.hasTabletSources?.[locale] && !bySlot.get("ipad_13")) {
        add({
          id: `apple-${locale}-ipad`,
          level: "warning",
          store: "app_store",
          locale,
          title: `${L}: tablet images but no iPad 13″ output`,
          detail: "If your app runs on iPad, App Store Connect requires at least one 13″ iPad screenshot (2064×2752).",
          fixPreset: "as_ipad_13",
        });
      }
      if (!bySlot.get("duo_outer") && !bySlot.get("duo_inner")) {
        add({
          id: `apple-${locale}-duo`,
          level: "info",
          store: "app_store",
          locale,
          title: `${L}: no iPhone Duo screenshots`,
          detail: "Optional for now; required from April 2027 for apps built with the iOS 27.1 SDK. Adds an “optimized for iPhone Duo” badge.",
        });
      }
    }

    // ─── Google Play ───
    const play = groups.get(`play_store/${locale}`) ?? [];
    if (play.length) {
      const byType = new Map<string, Job[]>();
      for (const j of play) byType.set(PLAY_TYPE(j.preset.id), [...(byType.get(PLAY_TYPE(j.preset.id)) ?? []), j]);
      const shots = play.filter((j) => j.preset.category === "screenshot");
      const features = byType.get("feature") ?? [];

      if (shots.length < LIMITS.playMinTotal) {
        add({
          id: `play-${locale}-min`,
          level: "error",
          store: "play_store",
          locale,
          title: `${L}: ${shots.length} Play screenshot${shots.length === 1 ? "" : "s"} (need at least ${LIMITS.playMinTotal})`,
          detail: "Play Console needs at least 2 screenshots to publish a listing.",
        });
      }
      for (const [type, list] of byType) {
        if (type !== "feature" && list.length > LIMITS.playMaxPerType) {
          add({
            id: `play-${locale}-${type}-max`,
            level: "error",
            store: "play_store",
            locale,
            title: `${L}: ${list.length} ${type === "phone" ? "phone" : type === "tablet_7" ? '7″ tablet' : '10″ tablet'} screenshots (max ${LIMITS.playMaxPerType})`,
            detail: `Play Console accepts up to ${LIMITS.playMaxPerType} per device type. Remove ${list.length - LIMITS.playMaxPerType}.`,
          });
        }
      }
      if (features.length === 0) {
        add({
          id: `play-${locale}-feature`,
          level: "error",
          store: "play_store",
          locale,
          title: `${L}: no feature graphic`,
          detail: "Play Console requires one 1024×500 feature graphic to publish. Drop a wide banner image (it's detected automatically).",
        });
      } else if (features.length > 1) {
        add({
          id: `play-${locale}-feature-many`,
          level: "error",
          store: "play_store",
          locale,
          title: `${L}: ${features.length} feature graphics (only 1 allowed)`,
          detail: "Keep one feature graphic per language and remove the others.",
        });
      }
      for (const type of ["tablet_7", "tablet_10"]) {
        const n = byType.get(type)?.length ?? 0;
        if (n > 0 && n < LIMITS.playLargeScreenMin) {
          add({
            id: `play-${locale}-${type}-few`,
            level: "warning",
            store: "play_store",
            locale,
            title: `${L}: ${n} ${type === "tablet_7" ? '7″' : '10″'} tablet screenshot${n === 1 ? "" : "s"} (large screens want ${LIMITS.playLargeScreenMin}+)`,
            detail: "Google Play asks for at least 4 tablet screenshots for large-screen listings. Add more, or switch Android tablets off if you don't need them.",
          });
        }
      }
      const promo = (byType.get("phone") ?? []).filter((j) => {
        const r = checkDimensions(j.preset, j.size).find((c) => c.level === "warn");
        return !r || r.ok;
      }).length;
      if (shots.length >= LIMITS.playMinTotal && promo < LIMITS.playPromoMin) {
        add({
          id: `play-${locale}-promo`,
          level: "info",
          store: "play_store",
          locale,
          title: `${L}: ${promo} promo-eligible phone screenshot${promo === 1 ? "" : "s"}`,
          detail: "Play features apps in recommendations when there are at least 4 phone screenshots at 9:16 (1080×1920 or larger).",
        });
      }
    }
  }

  // ─── Files that won't upload ───
  const failed = jobs.filter((j) => outputOf(j)?.status === "error");
  const nonCompliant = jobs.filter((j) => {
    const o = outputOf(j);
    return o?.status === "done" && o.compliance && !o.compliance.ok;
  });
  if (failed.length) {
    add({
      id: "files-failed",
      level: "error",
      store: "files",
      title: `${failed.length} output${failed.length === 1 ? "" : "s"} failed to render`,
      detail: "They will be missing from the ZIP. See the error on each preview.",
    });
  }
  if (nonCompliant.length) {
    add({
      id: "files-noncompliant",
      level: "error",
      store: "files",
      title: `${nonCompliant.length} file${nonCompliant.length === 1 ? " fails" : "s fail"} the store checks`,
      detail: nonCompliant.map((j) => j.pathStem.split("/").pop()).slice(0, 3).join(", ") + (nonCompliant.length > 3 ? "…" : ""),
    });
  }

  const errors = items.filter((i) => i.level === "error").length;
  const warnings = items.filter((i) => i.level === "warning").length;
  return { items, errors, warnings, checked: [...groups.keys()].sort(), ready: jobs.length > 0 && errors === 0 };
}
