import { describe, expect, it } from "vitest";
import { detectAsset, scaleFactor } from "@/utils/detect";

const MB = 1024 * 1024;
const d = (name: string, w: number, h: number, bytes = 1 * MB) => detectAsset(name, w, h, bytes);

describe("exact resolution matches", () => {
  it.each([
    [1320, 2868, "phone", /6\.9/],
    [1290, 2796, "phone", /6\.7/],
    [1179, 2556, "phone", /6\.1/],
    [750, 1334, "phone", /4\.7/],
    [2064, 2752, "tablet", /13/],
    [2048, 2732, "tablet", /12\.9/],
    [1640, 2360, "tablet", /Air/],
    [1080, 1920, "phone", /Android/],
    [1600, 2560, "tablet", /10/],
    [3840, 2400, "xr", /Android XR/],
    [1398, 2034, "foldable", /Duo outer/],
    [2007, 2853, "foldable", /Duo inner/],
    [2853, 2007, "foldable", /Duo inner/],
  ] as const)("%i×%i → %s", (w, h, device, label) => {
    const r = d("shot.png", w, h);
    expect(r.source).toBe("exact");
    expect(r.confidence).toBe("high");
    expect(r.deviceClass).toBe(device);
    expect(r.category).toBe("screenshot");
    expect(r.label).toMatch(label);
  });

  it("matches landscape screenshots too", () => {
    const r = d("shot.png", 2868, 1320);
    expect(r.source).toBe("exact");
    expect(r.orientation).toBe("landscape");
    expect(r.deviceClass).toBe("phone");
  });

  it("detects the exact Play feature graphic", () => {
    const r = d("banner.png", 1024, 500);
    expect(r.category).toBe("feature_graphic");
    expect(r.source).toBe("exact");
  });

  it("an exact resolution wins over folder-name hints", () => {
    expect(d("ipad/shot.png", 1320, 2868).deviceClass).toBe("phone");
  });
});

describe("aspect-ratio heuristics", () => {
  it("tall ≈19.5:9 → phone", () => {
    const r = d("x.png", 1000, 2170);
    expect(r).toMatchObject({ source: "ratio", deviceClass: "phone" });
  });
  it("16:9 → phone", () => expect(d("x.png", 900, 1600).deviceClass).toBe("phone"));
  it("≈3:4 → iPad", () => expect(d("x.png", 1500, 2000)).toMatchObject({ deviceClass: "tablet", label: expect.stringMatching(/iPad/) }));
  it("16:10 → Android tablet", () => expect(d("x.png", 1250, 2000).label).toMatch(/16:10/));
  it("≈2:1 landscape → feature graphic", () => expect(d("x.png", 2048, 1000).category).toBe("feature_graphic"));
  it("unusual ratios are low confidence", () => expect(d("x.png", 1000, 1700).confidence).toBe("low"));
});

describe("file and folder name hints", () => {
  it("tablet folder flips an ambiguous phone ratio", () => {
    const r = d("Screens/iPad/home.png", 900, 1600);
    expect(r).toMatchObject({ deviceClass: "tablet", source: "filename" });
  });
  it("tab as its own word counts, but not inside other words", () => {
    expect(d("tab/home.png", 900, 1600).deviceClass).toBe("tablet");
    expect(d("table_view.png", 900, 1600).deviceClass).toBe("phone");
  });
  it("xr / headset names mark Android XR, but not words that contain them", () => {
    expect(d("android_xr/01.png", 2000, 1250).deviceClass).toBe("xr");
    expect(d("headset/01.png", 2000, 1250).deviceClass).toBe("xr");
    expect(d("xray_scanner.png", 900, 1600).deviceClass).toBe("phone");
  });
  it("duo / fold folder names mark a foldable", () => {
    expect(d("en/iphone_duo/01.png", 1500, 2100).deviceClass).toBe("foldable");
    expect(d("fold/01.png", 1500, 2100).deviceClass).toBe("foldable");
    expect(d("Foldable Screens/01.png", 1500, 2100).deviceClass).toBe("foldable");
  });
  it("does not mistake other words for foldable", () => {
    expect(d("my_folder/01.png", 900, 1600).deviceClass).toBe("phone");
    expect(d("unfolded_view.png", 900, 1600).deviceClass).toBe("phone");
    expect(d("duolingo.png", 900, 1600).deviceClass).toBe("phone");
  });
  it("phone hint flips a tablet ratio", () => expect(d("android/phone/x.png", 1500, 2000).deviceClass).toBe("phone"));
  it("feature in the name marks a feature graphic", () => expect(d("feature.png", 900, 1600).category).toBe("feature_graphic"));
});

describe("locale", () => {
  it.each([
    ["th/iphone/01.png", "th"],
    ["shots_TH/01.png", "th"],
    ["home-th.png", "th"],
    ["home_th_TH.png", "th"],
    ["thai/01.png", "th"],
    ["หน้าแรก.png", "th"],
    ["en/iphone/01.png", "en-US"],
    ["method.png", "en-US"],
    ["the_app.png", "en-US"],
    ["with_thumbnail.png", "en-US"],
    ["ja/iphone/01.png", "ja"],
    ["de-DE/01.png", "de-DE"],
    ["home_fr.png", "fr-FR"],
  ])("%s → %s", (name, locale) => expect(d(name, 1320, 2868).locale).toBe(locale));
});

describe("size findings", () => {
  it("flags sources over Play's 8 MB", () => {
    expect(d("x.png", 1320, 2868, 9 * MB).notes.some((n) => n.text.includes("8 MB"))).toBe(true);
    expect(d("x.png", 1320, 2868, 2 * MB).notes.some((n) => n.text.includes("8 MB"))).toBe(false);
  });
  it("flags heavily compressed JPEGs only", () => {
    expect(d("x.jpg", 1320, 2868, 50_000).notes.some((n) => n.text.includes("JPEG"))).toBe(true);
    expect(d("x.png", 1320, 2868, 50_000).notes.some((n) => n.text.includes("JPEG"))).toBe(false);
  });
  it("warns when Apple targets need heavy upscaling", () => {
    const low = d("x.png", 750, 1334);
    expect(low.notes.some((n) => n.level === "warn" && n.text.includes("Low resolution"))).toBe(true);
    expect(d("x.png", 1320, 2868).notes.some((n) => n.text.includes("Low resolution"))).toBe(false);
  });
  it("treats an exact outer-display capture as expected, not low resolution", () => {
    const r = d("x.png", 1398, 2034);
    expect(r.notes.some((n) => n.text.includes("Low resolution"))).toBe(false);
    expect(r.notes).toContainEqual({ level: "info", text: expect.stringContaining("Outer-display capture") });
  });
  it("judges foldable resolution against the inner display", () => {
    expect(d("duo/x.png", 1000, 1400).notes.some((n) => n.text.includes("2.04×"))).toBe(true);
    expect(d("x.png", 2007, 2853).notes.some((n) => n.text.includes("Low resolution"))).toBe(false);
  });
  it("warns below Play's 320 px minimum", () => {
    expect(d("x.png", 300, 600).notes.some((n) => n.text.includes("320"))).toBe(true);
  });
  it("does not warn about resolution for feature graphics", () => {
    expect(d("x.png", 1024, 500).notes).toEqual([]);
  });
});

describe("aspect label", () => {
  it("reduces simple ratios", () => expect(d("x.png", 1080, 1920).aspect).toBe("9:16"));
  it("shows the real ratio when no familiar one is close", () => {
    expect(d("x.png", 2007, 2853).aspect).toBe("≈1:1.42");
    expect(d("x.png", 2853, 2007).aspect).toBe("≈1.42:1");
  });
  it("names messy ratios and keeps orientation", () => {
    expect(d("x.png", 1320, 2868).aspect).toBe("≈9:19.5");
    expect(d("x.png", 2868, 1320).aspect).toBe("≈19.5:9");
  });
});

describe("scaleFactor", () => {
  const src = { w: 1000, h: 2000 };
  it("fit uses the smaller ratio", () => expect(scaleFactor(src, { w: 1500, h: 2000 }, "fit")).toBe(1));
  it("fill uses the larger ratio", () => expect(scaleFactor(src, { w: 1500, h: 2000 }, "fill")).toBe(1.5));
  it("reports downscales below 1", () => expect(scaleFactor(src, { w: 500, h: 1000 }, "fit")).toBe(0.5));
});
