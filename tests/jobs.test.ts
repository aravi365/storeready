import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  buildJobs,
  excludePreset,
  excludedTargetsFor,
  restorePreset,
  inferMetadata,
  jobSig,
  renderOptionsFor,
  resolveOrientation,
  targetsFor,
  type Asset,
  type GlobalSettings,
} from "@/utils/jobs";
import type { Store } from "@/utils/presets";

let n = 0;
function asset(p: Partial<Asset> = {}): Asset {
  return {
    id: `a${n++}`,
    file: new File([], p.name ?? "shot.png"),
    name: "shot.png",
    thumbUrl: "",
    status: "ready",
    width: 1320,
    height: 2868,
    deviceClass: "phone",
    locale: "en-US",
    category: "screenshot",
    orientation: "auto",
    analysis: { hasTransparency: false, focus: { x: 0.4, y: 0.6 } },
    ...p,
  };
}
const settings = (p: Partial<GlobalSettings> = {}): GlobalSettings => ({ ...DEFAULT_SETTINGS, ...p });

describe("resolveOrientation", () => {
  it("auto follows the source shape", () => {
    expect(resolveOrientation({ orientation: "auto", width: 100, height: 200 })).toBe("portrait");
    expect(resolveOrientation({ orientation: "auto", width: 200, height: 100 })).toBe("landscape");
    expect(resolveOrientation({ orientation: "auto", width: 100, height: 100 })).toBe("portrait");
  });
  it("explicit choice wins", () => {
    expect(resolveOrientation({ orientation: "landscape", width: 100, height: 200 })).toBe("landscape");
  });
});

describe("targetsFor", () => {
  it("phone screenshot → default iPhone 6.9, required iPhone 6.3, and Play phone", () => {
    expect(targetsFor(asset(), settings()).map((t) => `${t.preset.id} ${t.size.w}x${t.size.h}`)).toEqual([
      "as_iphone_69 1320x2868",
      "as_iphone_63 1206x2622",
      "gp_phone 1080x1920",
    ]);
  });
  it("tablet screenshot → iPad 13 + Play 10-inch", () => {
    expect(targetsFor(asset({ deviceClass: "tablet" }), settings()).map((t) => t.preset.id)).toEqual(["as_ipad_13", "gp_tablet_10"]);
  });
  it("iPhone Duo screenshot → outer and inner display sizes", () => {
    const t = targetsFor(asset({ deviceClass: "foldable", width: 2007, height: 2853 }), settings());
    expect(t.map((x) => `${x.preset.folder} ${x.size.w}x${x.size.h}`)).toEqual(["iphone_duo_outer 1398x2034", "iphone_duo_inner 2007x2853"]);
  });
  it("landscape Duo screenshots get landscape sizes", () => {
    const t = targetsFor(asset({ deviceClass: "foldable", width: 2853, height: 2007 }), settings());
    expect(t.map((x) => x.size)).toEqual([{ w: 2034, h: 1398 }, { w: 2853, h: 2007 }]);
  });
  it("landscape sources get landscape targets", () => {
    const t = targetsFor(asset({ width: 2868, height: 1320 }), settings());
    expect(t.map((x) => x.size)).toEqual([{ w: 2868, h: 1320 }, { w: 2622, h: 1206 }, { w: 1920, h: 1080 }]);
  });
  it("feature graphic → only the 1024×500 preset", () => {
    expect(targetsFor(asset({ category: "feature_graphic", width: 1024, height: 500 }), settings()).map((t) => t.preset.id)).toEqual(["gp_feature"]);
  });
  it("no feature graphic when Play is switched off", () => {
    const s = settings({ stores: new Set<Store>(["app_store"]) });
    expect(targetsFor(asset({ category: "feature_graphic" }), s)).toEqual([]);
  });
});

describe("renderOptionsFor", () => {
  it("uses the global mode for screenshots and featureMode for feature graphics", () => {
    const s = settings({ mode: "fit", featureMode: "fill" });
    expect(renderOptionsFor(asset(), s).mode).toBe("fit");
    expect(renderOptionsFor(asset({ category: "feature_graphic" }), s).mode).toBe("fill");
  });
  it("per-asset overrides win", () => {
    const o = renderOptionsFor(asset({ mode: "stretch", backdrop: "solid" }), settings({ backdrop: "blur" }));
    expect(o).toMatchObject({ mode: "stretch", backdrop: "solid" });
  });
  it("smart crop passes the detected focus, or none when off", () => {
    expect(renderOptionsFor(asset(), settings({ smartCrop: true })).focus).toEqual({ x: 0.4, y: 0.6 });
    expect(renderOptionsFor(asset(), settings({ smartCrop: false })).focus).toBeUndefined();
  });
});

describe("buildJobs", () => {
  it("builds the spec folder layout with per-folder numbering", () => {
    const jobs = buildJobs(
      [
        asset({ name: "01_home.png" }),
        asset({ name: "02_settings.png" }),
        asset({ name: "home.png", locale: "th" }),
        asset({ name: "ipad.png", deviceClass: "tablet", width: 2064, height: 2752 }),
        asset({ name: "banner.png", category: "feature_graphic", width: 1024, height: 500 }),
        asset({ name: "duo.png", deviceClass: "foldable", locale: "th", width: 2007, height: 2853 }),
      ],
      settings(),
    );
    expect(jobs.map((j) => j.pathStem)).toEqual([
      "app-store-assets/app_store/en-US/iphone_6.9/01_home_1320x2868",
      "app-store-assets/app_store/en-US/iphone_6.3/01_home_1206x2622",
      "app-store-assets/play_store/en-US/phone/01_home_1080x1920",
      "app-store-assets/app_store/en-US/iphone_6.9/02_settings_1320x2868",
      "app-store-assets/app_store/en-US/iphone_6.3/02_settings_1206x2622",
      "app-store-assets/play_store/en-US/phone/02_settings_1080x1920",
      "app-store-assets/app_store/th/iphone_6.9/01_home_1320x2868",
      "app-store-assets/app_store/th/iphone_6.3/01_home_1206x2622",
      "app-store-assets/play_store/th/phone/01_home_1080x1920",
      "app-store-assets/app_store/en-US/ipad_13/01_ipad_2064x2752",
      "app-store-assets/play_store/en-US/tablet_10in/01_ipad_1440x2560",
      "app-store-assets/play_store/en-US/feature_graphic/01_banner_1024x500",
      "app-store-assets/app_store/th/iphone_duo_outer/01_duo_1398x2034",
      "app-store-assets/app_store/th/iphone_duo_inner/01_duo_2007x2853",
    ]);
  });

  it("skips assets that are decoding, failed, or in a locale that is switched off", () => {
    const jobs = buildJobs(
      [asset({ status: "decoding" }), asset({ status: "error" }), asset({ locale: "th" }), asset({ name: "ok.png" })],
      settings({ excludedLocales: new Set(["th"]) }),
    );
    expect(jobs).toHaveLength(3); // iPhone 6.9, iPhone 6.3, Play phone
    expect(jobs.every((j) => j.pathStem.includes("_ok_"))).toBe(true);
  });

  it("uses each store's own locale code in folder names", () => {
    const paths = buildJobs([asset({ name: "home.png", locale: "ja" }), asset({ name: "home.png", locale: "zh-Hans" })], settings()).map((j) =>
      j.pathStem.split("/").slice(1, 3).join("/"),
    );
    expect([...new Set(paths)]).toEqual(["app_store/ja", "play_store/ja-JP", "app_store/zh-Hans", "play_store/zh-CN"]);
  });

  it("sets the 8 MB cap for Play jobs only", () => {
    const jobs = buildJobs([asset()], settings());
    expect(jobs.find((j) => j.preset.store === "play_store")!.enc.maxBytes).toBe(8 * 1024 * 1024);
    expect(jobs.find((j) => j.preset.store === "app_store")!.enc.maxBytes).toBeUndefined();
  });

  it("gives each asset/preset pair a stable, unique id", () => {
    const a = asset();
    const ids = buildJobs([a, asset()], settings()).map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(`${a.id}:as_iphone_69`);
  });
});

describe("file name slugs", () => {
  const stem = (name: string) => buildJobs([asset({ name })], settings())[0].pathStem.split("/").pop();
  it.each([
    ["01_home.png", "01_home_1320x2868"],
    ["10 - Settings Screen.PNG", "01_settings_screen_1320x2868"],
    ["Home (Dark Mode).jpeg", "01_home_dark_mode_1320x2868"],
    ["123.png", "01_image_1320x2868"],
    ["___.png", "01_image_1320x2868"],
  ])("%s → %s", (name, expected) => expect(stem(name)).toBe(expected));

  it("keeps Thai names readable (including vowel and tone marks)", () => {
    expect(stem("หน้าแรก.png")).toBe("01_หน้าแรก_1320x2868");
  });
  it("keeps accented Latin letters", () => {
    expect(stem("Café Menü.png")).toBe("01_café_menü_1320x2868");
  });
  it("caps very long names", () => {
    expect(stem(`${"a".repeat(200)}.png`)!.length).toBeLessThanOrEqual(48 + "01__1320x2868".length);
  });
});

describe("jobSig", () => {
  it("changes when render options change, so stale outputs are re-rendered", () => {
    const [a] = buildJobs([asset()], settings({ matte: "#FFFFFF" }));
    const [b] = buildJobs([asset({ id: a.assetId })], settings({ matte: "#000000" }));
    const [c] = buildJobs([asset({ id: a.assetId })], settings({ matte: "#FFFFFF" }));
    expect(jobSig(a)).not.toBe(jobSig(b));
    expect(jobSig(a)).toBe(jobSig(c));
  });
});

describe("inferMetadata", () => {
  it("guesses from the name before the image is decoded", () => {
    expect(inferMetadata("th/ipad/01.png")).toEqual({ category: "screenshot", deviceClass: "tablet", locale: "th" });
    expect(inferMetadata("ja/ipad/01.png").locale).toBe("ja");
    expect(inferMetadata("ipad/01.png").locale).toBe("en-US");
    expect(inferMetadata("feature_en.png").category).toBe("feature_graphic");
    expect(inferMetadata("th/iphone_duo/01.png")).toMatchObject({ deviceClass: "foldable", locale: "th" });
  });
});

describe("removing individual outputs", () => {
  const ipad = () => asset({ name: "dash.png", deviceClass: "tablet", width: 2064, height: 2752 });

  it("drops only the removed output for that image (keep iPad 13, skip Play 10-inch)", () => {
    const a = ipad();
    a.excluded = excludePreset(a, "gp_tablet_10");
    expect(targetsFor(a, settings()).map((t) => t.preset.id)).toEqual(["as_ipad_13"]);
    expect(excludedTargetsFor(a, settings()).map((t) => t.preset.id)).toEqual(["gp_tablet_10"]);
    expect(buildJobs([a], settings()).map((j) => j.preset.id)).toEqual(["as_ipad_13"]);
  });

  it("does not affect other images", () => {
    const a = ipad();
    const b = ipad();
    a.excluded = ["gp_tablet_10"];
    const jobs = buildJobs([a, b], settings());
    expect(jobs.filter((j) => j.assetId === b.id).map((j) => j.preset.id)).toEqual(["as_ipad_13", "gp_tablet_10"]);
  });

  it("numbers the remaining files without gaps", () => {
    const a = ipad();
    const b = ipad();
    a.excluded = ["gp_tablet_10"];
    const play = buildJobs([a, b], settings()).filter((j) => j.preset.id === "gp_tablet_10");
    expect(play.map((j) => j.pathStem.split("/").pop())).toEqual(["01_dash_1440x2560"]);
  });

  it("restore brings it back; excluding twice is harmless", () => {
    const a = ipad();
    a.excluded = excludePreset({ excluded: excludePreset(a, "gp_tablet_10") }, "gp_tablet_10");
    expect(a.excluded).toEqual(["gp_tablet_10"]);
    a.excluded = restorePreset(a, "gp_tablet_10");
    expect(targetsFor(a, settings()).map((t) => t.preset.id)).toEqual(["as_ipad_13", "gp_tablet_10"]);
  });

  it("a removed preset that is also disabled globally isn't offered for restore", () => {
    const a = ipad();
    a.excluded = ["gp_tablet_10"];
    const s = settings({ presets: new Set(["as_ipad_13"]) });
    expect(excludedTargetsFor(a, s)).toEqual([]);
  });

  it("removing every output leaves the image with no jobs", () => {
    const a = ipad();
    a.excluded = ["as_ipad_13", "gp_tablet_10"];
    expect(buildJobs([a], settings())).toEqual([]);
  });
});
