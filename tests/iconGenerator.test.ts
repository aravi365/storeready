import { describe, expect, it } from "vitest";
import { DENSITIES, SAFE_ZONE, layoutRoots, planIcons, type IconSettings } from "@/utils/iconGenerator";

const base: IconSettings = {
  framework: "flutter",
  rnAppName: "MyApp",
  iosMode: "single",
  background: "#FFFFFF",
  iosScale: 0.8,
  androidScale: SAFE_ZONE,
  monochrome: true,
  darkVariants: false,
  darkBackground: "#111111",
};
const plan = (p: Partial<IconSettings> = {}, hasAlpha = true) => planIcons({ ...base, ...p }, { hasAlpha });
const paths = (r: ReturnType<typeof plan>) => r.files.map((f) => f.path);
const text = (r: ReturnType<typeof plan>, end: string) => r.texts.find((t) => t.path.endsWith(end))!.text;

describe("layoutRoots", () => {
  it.each([
    ["flutter", "ios/Runner/Assets.xcassets/AppIcon.appiconset", "android/app/src/main/res"],
    ["react-native", "ios/MyApp/Images.xcassets/AppIcon.appiconset", "android/app/src/main/res"],
    ["expo", "assets/images", "assets/images"],
    ["native", "ios/AppIcon.appiconset", "android/res"],
  ] as const)("%s", (framework, ios, android) => {
    expect(layoutRoots({ framework, rnAppName: "MyApp" })).toEqual({ ios, android });
  });
  it("sanitises the React Native target name", () => {
    expect(layoutRoots({ framework: "react-native", rnAppName: "My App!/.." }).ios).toBe("ios/MyApp/Images.xcassets/AppIcon.appiconset");
    expect(layoutRoots({ framework: "react-native", rnAppName: "" }).ios).toBe("ios/MyApp/Images.xcassets/AppIcon.appiconset");
  });
});

describe("store icons", () => {
  it("always includes opaque App Store 1024 and Play 512", () => {
    for (const framework of ["flutter", "react-native", "expo", "native"] as const) {
      const r = plan({ framework });
      expect(r.files.find((f) => f.path === "store/app_store_1024.png")).toMatchObject({ size: 1024, opaque: true });
      expect(r.files.find((f) => f.path === "store/play_store_512.png")).toMatchObject({ size: 512, opaque: true });
    }
  });
});

describe("iOS asset catalog", () => {
  it("single-size mode: one 1024 universal icon", () => {
    const r = plan();
    const contents = JSON.parse(text(r, "Contents.json"));
    expect(contents.images).toEqual([{ filename: "AppIcon-1024.png", idiom: "universal", platform: "ios", size: "1024x1024" }]);
    expect(contents.info).toEqual({ version: 1, author: "xcode" });
  });

  it("legacy mode lists every iPhone, iPad and marketing size, and every file exists", () => {
    const r = plan({ iosMode: "legacy" });
    const contents = JSON.parse(text(r, "Contents.json"));
    expect(contents.images).toHaveLength(18);
    const ios = r.files.filter((f) => f.platform === "ios");
    const names = new Set(ios.map((f) => f.path.split("/").pop()));
    for (const img of contents.images) expect(names.has(img.filename)).toBe(true);
    const px = Object.fromEntries(ios.map((f) => [f.path.split("/").pop(), f.size]));
    expect(px["Icon-App-60x60@3x.png"]).toBe(180);
    expect(px["Icon-App-83.5x83.5@2x.png"]).toBe(167);
    expect(px["Icon-App-1024x1024@1x.png"]).toBe(1024);
    expect(px["Icon-App-20x20@1x.png"]).toBe(20);
    expect(new Set(ios.map((f) => f.path)).size).toBe(ios.length); // no duplicate files
  });

  it("all iOS icons are opaque (Apple rejects alpha)", () => {
    for (const iosMode of ["single", "legacy"] as const) {
      expect(plan({ iosMode }).files.filter((f) => f.platform === "ios").every((f) => f.opaque)).toBe(true);
    }
  });

  it("dark & tinted variants only for a transparent logo in single-size mode", () => {
    const withDark = plan({ darkVariants: true });
    const images = JSON.parse(text(withDark, "Contents.json")).images;
    expect(images.map((i: { appearances?: { value: string }[] }) => i.appearances?.[0].value ?? "light")).toEqual(["light", "dark", "tinted"]);
    expect(paths(withDark)).toContain("ios/Runner/Assets.xcassets/AppIcon.appiconset/AppIcon-1024-dark.png");
    expect(paths(plan({ darkVariants: true }, false)).some((p) => p.includes("dark"))).toBe(false);
    expect(paths(plan({ darkVariants: true, iosMode: "legacy" })).some((p) => p.includes("dark"))).toBe(false);
  });
});

describe("Android resources", () => {
  it("writes every density at the right pixel size", () => {
    const r = plan();
    for (const d of DENSITIES) {
      const dir = `android/app/src/main/res/mipmap-${d.name}`;
      const size = (name: string) => r.files.find((f) => f.path === `${dir}/${name}`)?.size;
      expect(size("ic_launcher.png")).toBe(48 * d.scale);
      expect(size("ic_launcher_round.png")).toBe(48 * d.scale);
      expect(size("ic_launcher_foreground.png")).toBe(108 * d.scale);
      expect(size("ic_launcher_monochrome.png")).toBe(108 * d.scale);
    }
    expect(DENSITIES.map((d) => 48 * d.scale)).toEqual([48, 72, 96, 144, 192]);
  });

  it("adaptive icon XML references background, foreground and monochrome", () => {
    const xml = text(plan(), "mipmap-anydpi-v26/ic_launcher.xml");
    expect(xml).toContain('@color/ic_launcher_background');
    expect(xml).toContain('@mipmap/ic_launcher_foreground');
    expect(xml).toContain('@mipmap/ic_launcher_monochrome');
    expect(text(plan(), "mipmap-anydpi-v26/ic_launcher_round.xml")).toBe(xml);
  });

  it("skips the monochrome layer for opaque artwork or when turned off", () => {
    for (const r of [plan({}, false), plan({ monochrome: false })]) {
      expect(paths(r).some((p) => p.includes("monochrome"))).toBe(false);
      expect(text(r, "ic_launcher.xml")).not.toContain("monochrome");
    }
  });

  it("writes the background colour resource", () => {
    expect(text(plan({ background: "#1A2B3C" }), "values/ic_launcher_background.xml")).toContain(
      '<color name="ic_launcher_background">#1A2B3C</color>',
    );
  });

  it("legacy icon logo scale never exceeds the canvas", () => {
    const r = plan({ androidScale: 1 });
    for (const f of r.files.filter((x) => /ic_launcher(_round)?\.png$/.test(x.path))) {
      expect(f.layer.scale).toBeLessThanOrEqual(1);
    }
  });
});

describe("Expo", () => {
  it("writes assets/images files and an app.json snippet", () => {
    const r = plan({ framework: "expo", darkVariants: true });
    expect(paths(r)).toEqual(
      expect.arrayContaining(["assets/images/icon.png", "assets/images/adaptive-icon.png", "assets/images/monochrome-icon.png", "assets/images/icon-dark.png"]),
    );
    const snippet = JSON.parse(text(r, "app.json.snippet.json"));
    expect(snippet.expo.android.adaptiveIcon).toEqual({
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#FFFFFF",
      monochromeImage: "./assets/images/monochrome-icon.png",
    });
    expect(snippet.expo.ios.icon.dark).toBe("./assets/images/icon-dark.png");
    expect(r.texts.some((t) => t.path.endsWith("Contents.json"))).toBe(false);
  });
});

describe("file list", () => {
  it("has no duplicate paths for any configuration", () => {
    for (const framework of ["flutter", "react-native", "expo", "native"] as const)
      for (const iosMode of ["single", "legacy"] as const)
        for (const hasAlpha of [true, false]) {
          const r = plan({ framework, iosMode, darkVariants: true }, hasAlpha);
          const all = [...paths(r), ...r.texts.map((t) => t.path)];
          expect(new Set(all).size).toBe(all.length);
        }
  });

  it("Flutter single-size plan has the expected 27 assets", () => {
    const r = plan();
    expect(r.files.length + r.texts.length).toBe(27); // + README.md = the 28 files in the ZIP
  });
});
