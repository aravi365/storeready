import { describe, expect, it } from "vitest";
import {
  PLAY_MAX_BYTES,
  PRESETS,
  PLAY_TABLET_IDS,
  PRESET_BY_ID,
  setPlayTablets,
  checkDimensions,
  evaluate,
  presetsFor,
  sizeFor,
  type Store,
} from "@/utils/presets";

const all = new Set(PRESETS.map((p) => p.id));
const stores = new Set<Store>(["app_store", "play_store"]);
const passes = (id: string, w: number, h: number) =>
  checkDimensions(PRESET_BY_ID[id], { w, h }).every((c) => c.ok || c.level === "warn");

describe("preset table", () => {
  it("has unique ids and unique folders per store", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const store of ["app_store", "play_store"]) {
      const folders = PRESETS.filter((p) => p.store === store).map((p) => p.folder);
      expect(new Set(folders).size).toBe(folders.length);
    }
  });

  it("enables the folder layout from the spec by default", () => {
    const folders = PRESETS.filter((p) => p.defaultEnabled).map((p) => `${p.store}/${p.folder}`).sort();
    expect(folders).toEqual(
      [
        "app_store/ipad_13",
        "app_store/iphone_6.3",
        "app_store/iphone_6.9",
        "app_store/iphone_duo_inner",
        "app_store/iphone_duo_outer",
        "play_store/feature_graphic",
        "play_store/phone",
        "play_store/tablet_10in",
        "play_store/tablet_7in",
        "play_store/xr",
      ].sort(),
    );
  });

  it("exports Apple's required medium Dynamic Island iPhone size by default", () => {
    expect(PRESET_BY_ID.as_iphone_63.defaultEnabled).toBe(true);
  });

  it("uses the verified 2026 sizes", () => {
    expect(PRESET_BY_ID.as_iphone_69.portrait).toEqual({ w: 1320, h: 2868 });
    expect(PRESET_BY_ID.as_iphone_63.portrait).toEqual({ w: 1206, h: 2622 });
    expect(PRESET_BY_ID.as_iphone_67.portrait).toEqual({ w: 1290, h: 2796 });
    expect(PRESET_BY_ID.as_ipad_13.portrait).toEqual({ w: 2064, h: 2752 });
    expect(PRESET_BY_ID.as_ipad_129.portrait).toEqual({ w: 2048, h: 2732 });
    expect(PRESET_BY_ID.gp_phone.portrait).toEqual({ w: 2160, h: 3840 });
    expect(PRESET_BY_ID.gp_tablet_10.portrait).toEqual({ w: 2160, h: 3840 });
    expect(PRESET_BY_ID.gp_tablet_7.portrait).toEqual({ w: 2160, h: 3840 });
    expect(PRESET_BY_ID.gp_feature.portrait).toEqual({ w: 1024, h: 500 });
    expect(PRESET_BY_ID.as_duo_outer.portrait).toEqual({ w: 1398, h: 2034 });
    expect(PRESET_BY_ID.as_duo_inner.portrait).toEqual({ w: 2007, h: 2853 });
  });
});

describe("sizeFor", () => {
  it("transposes for landscape", () => {
    expect(sizeFor(PRESET_BY_ID.as_iphone_69, "landscape")).toEqual({ w: 2868, h: 1320 });
    expect(sizeFor(PRESET_BY_ID.as_iphone_69, "portrait")).toEqual({ w: 1320, h: 2868 });
  });
  it("never rotates the landscape-only feature graphic", () => {
    expect(sizeFor(PRESET_BY_ID.gp_feature, "portrait")).toEqual({ w: 1024, h: 500 });
  });
});

describe("every preset's own output is compliant", () => {
  for (const p of PRESETS) {
    for (const o of ["portrait", "landscape"] as const) {
      it(`${p.id} ${o}`, () => {
        const size = sizeFor(p, o);
        const checks = checkDimensions(p, size);
        if (p.warning) {
          // Legacy 16:10 tablet presets: allowed sizes, but fail the current 9:16 guidance.
          expect(checks.find((c) => c.label.includes("aspect"))?.ok).toBe(false);
        } else {
          expect(checks.every((c) => c.ok || c.level === "warn")).toBe(true);
        }
      });
    }
  }
});

describe("checkDimensions rules", () => {
  it("Apple accepts only listed sizes in either orientation", () => {
    expect(passes("as_iphone_69", 1320, 2868)).toBe(true);
    expect(passes("as_iphone_69", 2868, 1320)).toBe(true);
    expect(passes("as_iphone_69", 1290, 2796)).toBe(true);
    expect(passes("as_iphone_69", 1260, 2736)).toBe(true);
    expect(passes("as_iphone_69", 1320, 2867)).toBe(false);
    expect(passes("as_iphone_69", 1080, 1920)).toBe(false);
    expect(passes("as_iphone_63", 1206, 2622)).toBe(true);
    expect(passes("as_iphone_63", 1179, 2556)).toBe(true);
    expect(passes("as_iphone_63", 2622, 1206)).toBe(true);
    expect(passes("as_iphone_63", 1320, 2868)).toBe(false);
    expect(passes("as_ipad_13", 2048, 2732)).toBe(true);
    expect(passes("as_ipad_13", 2064, 2751)).toBe(false);
  });

  it("iPhone Duo accepts each display's exact size, in either orientation, and nothing else", () => {
    expect(passes("as_duo_outer", 1398, 2034)).toBe(true);
    expect(passes("as_duo_outer", 2034, 1398)).toBe(true);
    expect(passes("as_duo_inner", 2007, 2853)).toBe(true);
    expect(passes("as_duo_inner", 2853, 2007)).toBe(true);
    expect(passes("as_duo_outer", 2007, 2853)).toBe(false); // inner size in the outer slot
    expect(passes("as_duo_inner", 1320, 2868)).toBe(false);
  });

  it("Android XR: 8:5 required, 1920×1200+ recommended", () => {
    expect(passes("gp_xr", 3840, 2400)).toBe(true);
    expect(passes("gp_xr", 1920, 1200)).toBe(true);
    expect(passes("gp_xr", 2400, 3840)).toBe(true); // same ratio either way
    expect(passes("gp_xr", 3840, 2160)).toBe(false); // 16:9 is not 8:5
    expect(passes("gp_xr", 1600, 1000)).toBe(true); // 8:5 but below the recommendation: warning only
    expect(checkDimensions(PRESET_BY_ID.gp_xr, { w: 1600, h: 1000 }).find((c) => c.level === "warn")?.ok).toBe(false);
    expect(sizeFor(PRESET_BY_ID.gp_xr, "portrait")).toEqual({ w: 3840, h: 2400 });
  });

  it("feature graphic must be exactly 1024×500", () => {
    expect(passes("gp_feature", 1024, 500)).toBe(true);
    expect(passes("gp_feature", 500, 1024)).toBe(false);
    expect(passes("gp_feature", 1025, 500)).toBe(false);
  });

  it("Play phone: 320–3840 px and long side ≤ 2× short side", () => {
    expect(passes("gp_phone", 320, 640)).toBe(true); // exactly 2:1
    expect(passes("gp_phone", 320, 641)).toBe(false); // just over 2:1
    expect(passes("gp_phone", 319, 600)).toBe(false); // under minimum
    expect(passes("gp_phone", 2000, 3841)).toBe(false); // over maximum
    expect(passes("gp_phone", 3840, 3840)).toBe(true);
  });

  it("Play phone promo check is only a warning", () => {
    const checks = checkDimensions(PRESET_BY_ID.gp_phone, { w: 1000, h: 1600 });
    const promo = checks.find((c) => c.level === "warn")!;
    expect(promo.ok).toBe(false);
    expect(passes("gp_phone", 1000, 1600)).toBe(true);
  });

  it("Play large screens need 9:16 / 16:9 and 1080–7680 px sides", () => {
    expect(passes("gp_tablet_10", 1440, 2560)).toBe(true);
    expect(passes("gp_tablet_10", 2560, 1440)).toBe(true);
    expect(passes("gp_tablet_10", 1600, 2560)).toBe(false); // 16:10
    expect(passes("gp_tablet_10", 900, 1600)).toBe(false); // 9:16 but under 1080
    expect(passes("gp_tablet_10", 4320, 7680)).toBe(true);
    expect(passes("gp_tablet_10", 4500, 8000)).toBe(false); // over 7680
  });
});

describe("evaluate", () => {
  const p = PRESET_BY_ID.gp_phone;
  const size = { w: 1080, h: 1920 };

  it("passes a clean RGB PNG under the size cap", () => {
    const r = evaluate(p, size, { hasAlpha: false, format: "png", bytes: 1_000_000 });
    expect(r.ok).toBe(true);
  });
  it("fails when the file has an alpha channel", () => {
    expect(evaluate(p, size, { hasAlpha: true, format: "png" }).ok).toBe(false);
  });
  it("fails over Play's 8 MB cap, passes at exactly 8 MB", () => {
    expect(evaluate(p, size, { hasAlpha: false, format: "png", bytes: PLAY_MAX_BYTES + 1 }).ok).toBe(false);
    expect(evaluate(p, size, { hasAlpha: false, format: "png", bytes: PLAY_MAX_BYTES }).ok).toBe(true);
  });
  it("adds no size check for Apple (no published cap)", () => {
    const r = evaluate(PRESET_BY_ID.as_iphone_69, { w: 1320, h: 2868 }, { hasAlpha: false, format: "jpeg", bytes: 50_000_000 });
    expect(r.ok).toBe(true);
    expect(r.checks.some((c) => c.label.includes("MB"))).toBe(false);
  });
  it("labels the format correctly", () => {
    expect(evaluate(p, size, { hasAlpha: false, format: "jpeg" }).checks.at(-1)!.label).toMatch(/JPEG/);
  });
});

describe("presetsFor", () => {
  it("matches device class for screenshots", () => {
    const ids = presetsFor("phone", "screenshot", all, stores).map((p) => p.id);
    expect(ids).toContain("as_iphone_69");
    expect(ids).toContain("gp_phone");
    expect(ids).not.toContain("as_ipad_13");
    expect(ids).not.toContain("gp_feature");
  });
  it("foldable screenshots get both iPhone Duo displays and nothing else", () => {
    expect(presetsFor("foldable", "screenshot", all, stores).map((p) => p.id)).toEqual(["as_duo_outer", "as_duo_inner"]);
    expect(presetsFor("phone", "screenshot", all, stores).some((p) => p.deviceClass === "foldable")).toBe(false);
  });
  it("returns only the feature graphic for feature assets, regardless of device", () => {
    expect(presetsFor("tablet", "feature_graphic", all, stores).map((p) => p.id)).toEqual(["gp_feature"]);
    expect(presetsFor("foldable", "feature_graphic", all, stores).map((p) => p.id)).toEqual(["gp_feature"]);
  });
  it("respects disabled stores and presets", () => {
    expect(presetsFor("phone", "screenshot", all, new Set<Store>(["app_store"])).every((p) => p.store === "app_store")).toBe(true);
    expect(presetsFor("phone", "feature_graphic", all, new Set<Store>(["app_store"]))).toEqual([]);
    expect(presetsFor("phone", "screenshot", new Set(["gp_phone"]), stores).map((p) => p.id)).toEqual(["gp_phone"]);
  });
});

describe("Android tablet switch", () => {
  const defaults = new Set(PRESETS.filter((p) => p.defaultEnabled).map((p) => p.id));

  it("covers every Play tablet preset and nothing else", () => {
    expect(PLAY_TABLET_IDS.sort()).toEqual(["gp_tablet_10", "gp_tablet_10_legacy", "gp_tablet_7", "gp_tablet_7_legacy"].sort());
  });

  it("off removes all Play tablet sizes and keeps iPad, phones and the feature graphic", () => {
    const off = setPlayTablets(new Set([...defaults, "gp_tablet_7", "gp_tablet_10_legacy"]), false);
    expect(PLAY_TABLET_IDS.some((id) => off.has(id))).toBe(false);
    for (const id of ["as_ipad_13", "as_iphone_69", "as_iphone_63", "gp_phone", "gp_feature"]) expect(off.has(id)).toBe(true);
    expect(presetsFor("tablet", "screenshot", off, stores).map((p) => p.id)).toEqual(["as_ipad_13"]);
  });

  it("on restores the default 10-inch 9:16 size", () => {
    const on = setPlayTablets(setPlayTablets(defaults, false), true);
    expect([...on].sort()).toEqual([...defaults].sort());
  });

  it("does not mutate the input set", () => {
    const input = new Set(defaults);
    setPlayTablets(input, false);
    expect(input).toEqual(defaults);
  });
});
