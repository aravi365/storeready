import { describe, expect, it } from "vitest";
import { EMPTY_LISTING } from "@/utils/listingRules";
import { featureGraphicFor, previewLanguages, previewStore, shotsFor, type PreviewShot } from "@/utils/previewStore";

let n = 0;
const shot = (p: Partial<PreviewShot>): PreviewShot => ({
  jobId: `j${n++}`,
  store: "app_store",
  presetId: "as_iphone_69",
  deviceClass: "phone",
  category: "screenshot",
  locale: "en-US",
  width: 1320,
  height: 2868,
  url: "blob:x",
  order: 0,
  ...p,
});

describe("shotsFor", () => {
  it("iPhone prefers the 6.9-inch set, falling back to 6.3-inch", () => {
    const shots = [shot({ presetId: "as_iphone_63", width: 1206, height: 2622 }), shot({ presetId: "as_iphone_69" })];
    expect(shotsFor(shots, "iphone", "en-US").map((s) => s.presetId)).toEqual(["as_iphone_69"]);
    expect(shotsFor(shots.slice(0, 1), "iphone", "en-US").map((s) => s.presetId)).toEqual(["as_iphone_63"]);
  });

  it("keeps upload order", () => {
    const shots = [shot({ order: 2, jobId: "c" }), shot({ order: 0, jobId: "a" }), shot({ order: 1, jobId: "b" })];
    expect(shotsFor(shots, "iphone", "en-US").map((s) => s.jobId)).toEqual(["a", "b", "c"]);
  });

  it("picks the right set per device", () => {
    const shots = [
      shot({ presetId: "as_ipad_13" }),
      shot({ store: "play_store", presetId: "gp_phone" }),
      shot({ store: "play_store", presetId: "gp_tablet_7" }),
      shot({ store: "play_store", presetId: "gp_tablet_10" }),
    ];
    expect(shotsFor(shots, "ipad", "en-US").map((s) => s.presetId)).toEqual(["as_ipad_13"]);
    expect(shotsFor(shots, "android-phone", "en-US").map((s) => s.presetId)).toEqual(["gp_phone"]);
    expect(shotsFor(shots, "android-tablet", "en-US").map((s) => s.presetId)).toEqual(["gp_tablet_10"]);
  });

  it("filters by language and ignores feature graphics", () => {
    const shots = [shot({ locale: "ja" }), shot({ category: "feature_graphic", presetId: "as_iphone_69" })];
    expect(shotsFor(shots, "iphone", "en-US")).toEqual([]);
    expect(shotsFor(shots, "iphone", "ja")).toHaveLength(1);
  });

  it("returns nothing when a device has no screenshots", () => {
    expect(shotsFor([shot({})], "ipad", "en-US")).toEqual([]);
  });
});

describe("feature graphic and languages", () => {
  it("finds the feature graphic for a language", () => {
    const fg = shot({ store: "play_store", presetId: "gp_feature", category: "feature_graphic", locale: "th", width: 1024, height: 500 });
    expect(featureGraphicFor([shot({}), fg], "th")).toBe(fg);
    expect(featureGraphicFor([shot({}), fg], "en-US")).toBeUndefined();
  });

  it("lists languages with the most screenshots first, plus languages that only have text", () => {
    const data = {
      shots: [shot({ locale: "ja" }), shot({ locale: "ja" }), shot({ locale: "en-US" })],
      listings: { "en-US": EMPTY_LISTING, "de-DE": EMPTY_LISTING },
      company: "",
    };
    expect(previewLanguages(data)).toEqual(["ja", "en-US", "de-DE"]);
  });
});

describe("previewStore", () => {
  it("notifies subscribers and keeps the latest data", () => {
    let calls = 0;
    const off = previewStore.subscribe(() => calls++);
    previewStore.setShots([shot({})]);
    previewStore.setIcon({ apple: "a", play: "p" });
    previewStore.setListings({ "en-US": EMPTY_LISTING }, "Acme");
    off();
    previewStore.setShots([]);
    expect(calls).toBe(3);
    expect(previewStore.get()).toMatchObject({ icon: { apple: "a" }, company: "Acme", shots: [] });
  });
});
