import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { DEFAULT_SETTINGS, buildJobs, type Asset, type GlobalSettings, type Job } from "@/utils/jobs";
import { LIMITS, checkReadiness } from "@/utils/readiness";
import { buildZip } from "@/utils/zipExporter";

let n = 0;
const asset = (p: Partial<Asset> = {}): Asset => ({
  id: `r${n++}`,
  file: new File([], "x.png"),
  name: "shot.png",
  thumbUrl: "",
  status: "ready",
  width: 1320,
  height: 2868,
  deviceClass: "phone",
  locale: "en",
  category: "screenshot",
  orientation: "auto",
  ...p,
});
const phone = (p: Partial<Asset> = {}) => asset(p);
const tablet = (p: Partial<Asset> = {}) => asset({ deviceClass: "tablet", width: 2064, height: 2752, ...p });
const feature = (p: Partial<Asset> = {}) => asset({ category: "feature_graphic", width: 1024, height: 500, ...p });
const settings = (p: Partial<GlobalSettings> = {}): GlobalSettings => ({ ...DEFAULT_SETTINGS, ...p });

const report = (assets: Asset[], s = settings(), outputOf: (j: Job) => undefined | { status: "done" | "error" | "rendering"; compliance?: { ok: boolean; checks: [] } } = () => undefined) => {
  const hasTabletSources = { en: assets.some((a) => a.locale === "en" && a.deviceClass === "tablet"), th: assets.some((a) => a.locale === "th" && a.deviceClass === "tablet") };
  return checkReadiness(buildJobs(assets, s), outputOf, { hasTabletSources });
};
const ids = (r: ReturnType<typeof report>) => r.items.map((i) => i.id);
const times = <T,>(k: number, f: (i: number) => T) => Array.from({ length: k }, (_, i) => f(i));

describe("a complete set is ready", () => {
  it("4 phone shots + feature graphic in one language: no errors or warnings", () => {
    const r = report([...times(4, () => phone()), feature()]);
    expect(r.errors).toBe(0);
    expect(r.warnings).toBe(0);
    expect(r.ready).toBe(true);
    expect(r.checked).toEqual(["app_store/en", "play_store/en"]);
    // Only the optional iPhone Duo note remains
    expect(r.items.map((i) => i.level)).toEqual(["info"]);
  });

  it("an empty export is not 'ready'", () => {
    expect(report([]).ready).toBe(false);
    expect(report([]).checked).toEqual([]);
  });
});

describe("Apple rules", () => {
  it("missing the required 6.3-inch iPhone size is an error with a one-click fix", () => {
    const r = report([phone(), phone(), feature()], settings({ presets: new Set(["as_iphone_69", "gp_phone", "gp_feature"]) }));
    const item = r.items.find((i) => i.id === "apple-en-medium")!;
    expect(item.level).toBe("error");
    expect(item.fixPreset).toBe("as_iphone_63");
    expect(r.ready).toBe(false);
  });

  it("removing 6.3-inch for every image also triggers it", () => {
    const r = report([phone({ excluded: ["as_iphone_63"] }), phone({ excluded: ["as_iphone_63"] }), feature()]);
    expect(ids(r)).toContain("apple-en-medium");
  });

  it("more than 10 per display size is an error; exactly 10 is fine", () => {
    expect(ids(report([...times(10, () => phone()), feature()]))).not.toContain("apple-en-iphone_large-max");
    const r = report([...times(11, () => phone()), feature()]);
    expect(r.items.find((i) => i.id === "apple-en-iphone_large-max")?.title).toMatch(/11 iPhone 6\.9″? screenshots|11 iPhone 6.9" screenshots/);
    expect(ids(r)).toContain("apple-en-iphone_medium-max");
  });

  it("6.9-inch and its accepted 6.7-inch size share one slot", () => {
    const s = settings({ presets: new Set([...DEFAULT_SETTINGS.presets, "as_iphone_67"]) });
    const r = report([...times(6, () => phone()), feature()], s); // 6 × (6.9 + 6.7) = 12 in one slot
    expect(ids(r)).toContain("apple-en-iphone_large-max");
  });

  it("tablet uploads with no iPad 13 output warn, with a fix", () => {
    const r = report([phone(), phone(), feature(), tablet({ excluded: ["as_ipad_13"] })]);
    const item = r.items.find((i) => i.id === "apple-en-ipad")!;
    expect(item).toMatchObject({ level: "warning", fixPreset: "as_ipad_13" });
  });

  it("phone-only apps get no iPad warning", () => {
    expect(ids(report([phone(), phone(), feature()]))).not.toContain("apple-en-ipad");
  });

  it("iPhone Duo is only an info note, and disappears once Duo shots exist", () => {
    expect(report([phone(), phone(), feature()]).items.find((i) => i.id === "apple-en-duo")?.level).toBe("info");
    const r = report([phone(), phone(), feature(), asset({ deviceClass: "foldable", width: 2007, height: 2853 })]);
    expect(ids(r)).not.toContain("apple-en-duo");
  });

  it("Apple rules don't run when the App Store is switched off", () => {
    const r = report([phone(), phone(), feature()], settings({ stores: new Set(["play_store"]) }));
    expect(r.items.some((i) => i.store === "app_store")).toBe(false);
  });
});

describe("Google Play rules", () => {
  const playOnly = settings({ stores: new Set(["play_store"]) });

  it("fewer than 2 screenshots is an error", () => {
    const r = report([phone(), feature()], playOnly);
    expect(r.items.find((i) => i.id === "play-en-min")?.level).toBe("error");
    expect(ids(report([phone(), phone(), feature()], playOnly))).not.toContain("play-en-min");
  });

  it("phone and tablet shots both count towards the minimum of 2", () => {
    expect(ids(report([phone(), tablet(), feature()], playOnly))).not.toContain("play-en-min");
  });

  it("more than 8 per device type is an error; exactly 8 is fine", () => {
    expect(ids(report([...times(8, () => phone()), feature()], playOnly))).not.toContain("play-en-phone-max");
    expect(report([...times(9, () => phone()), feature()], playOnly).items.find((i) => i.id === "play-en-phone-max")?.level).toBe("error");
  });

  it("a missing feature graphic is an error; two is also an error", () => {
    expect(report([phone(), phone()], playOnly).items.find((i) => i.id === "play-en-feature")?.level).toBe("error");
    expect(ids(report([phone(), phone(), feature(), feature()], playOnly))).toContain("play-en-feature-many");
  });

  it("1–3 tablet screenshots warn; 4 is fine; 0 means tablets are skipped", () => {
    expect(report([phone(), phone(), feature(), tablet()], playOnly).items.find((i) => i.id === "play-en-tablet_10-few")?.level).toBe("warning");
    expect(ids(report([phone(), phone(), feature(), ...times(4, () => tablet())], playOnly))).not.toContain("play-en-tablet_10-few");
    expect(ids(report([phone(), phone(), feature()], playOnly)).some((i) => i.includes("tablet"))).toBe(false);
  });

  it("fewer than 4 promo-eligible phone shots is only an info tip", () => {
    const r = report([phone(), phone(), feature()], playOnly);
    expect(r.items.find((i) => i.id === "play-en-promo")?.level).toBe("info");
    expect(ids(report([...times(4, () => phone()), feature()], playOnly))).not.toContain("play-en-promo");
  });
});

describe("per-language checks", () => {
  it("checks each language separately", () => {
    const r = report([...times(2, () => phone()), feature(), phone({ locale: "th" })]);
    expect(r.checked).toEqual(["app_store/en", "app_store/th", "play_store/en", "play_store/th"]);
    expect(ids(r)).toEqual(expect.arrayContaining(["play-th-min", "play-th-feature"]));
    expect(ids(r)).not.toContain("play-en-feature");
  });

  it("languages switched off are not checked", () => {
    const r = report([phone(), phone(), feature(), phone({ locale: "th" })], settings({ locales: new Set(["en"]) }));
    expect(r.checked.some((c) => c.endsWith("/th"))).toBe(false);
  });
});

describe("file checks", () => {
  it("flags failed renders and non-compliant files", () => {
    const assets = [...times(4, () => phone()), feature()];
    const jobs = buildJobs(assets, settings());
    const bad = new Set([jobs[0].id, jobs[1].id]);
    const r = checkReadiness(jobs, (j) =>
      j.id === jobs[0].id ? { status: "error" } : bad.has(j.id) ? { status: "done", compliance: { ok: false, checks: [] } } : { status: "done", compliance: { ok: true, checks: [] } },
    );
    expect(r.items.find((i) => i.id === "files-failed")?.title).toMatch(/^1 output failed/);
    expect(r.items.find((i) => i.id === "files-noncompliant")?.title).toMatch(/^1 file fails/);
    expect(r.ready).toBe(false);
  });

  it("outputs still rendering don't count as problems", () => {
    const assets = [...times(4, () => phone()), feature()];
    expect(checkReadiness(buildJobs(assets, settings()), () => ({ status: "rendering" })).errors).toBe(0);
  });
});

describe("limits match the published rules", () => {
  it("uses Apple 10 / Play 2–8, 4 for large screens and promo", () => {
    expect(LIMITS).toEqual({ appleMaxPerSize: 10, playMinTotal: 2, playMaxPerType: 8, playLargeScreenMin: 4, playPromoMin: 4 });
  });
});

describe("manifest", () => {
  it("includes the readiness report", async () => {
    const r = report([phone(), feature()]);
    const blob = await buildZip(
      [{ path: "app-store-assets/a.png", blob: new Blob([new Uint8Array(3)]), width: 1, height: 1, store: "app_store", locale: "en", preset: "x", source: "s", compliance: { ok: true, checks: [] } }],
      undefined,
      { readiness: r },
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const m = JSON.parse(await zip.file("app-store-assets/manifest.json")!.async("string"));
    expect(m.readiness.errors).toBe(r.errors);
    expect(m.readiness.items.length).toBe(r.items.length);
  });
});
