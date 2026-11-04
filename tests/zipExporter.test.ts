import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildZip, type ZipEntry } from "@/utils/zipExporter";

const entry = (path: string, bytes = 100): ZipEntry => ({
  path,
  blob: new Blob([new Uint8Array(bytes).fill(7)], { type: "image/png" }),
  width: 1080,
  height: 1920,
  store: path.includes("play_store") ? "play_store" : "app_store",
  locale: "en",
  preset: "gp_phone",
  source: "home.png",
  compliance: { ok: !path.includes("bad"), checks: [] },
});

describe("buildZip", () => {
  it("writes every file at its path plus a manifest", async () => {
    const paths = [
      "app-store-assets/app_store/en/iphone_6.9/01_home_1320x2868.png",
      "app-store-assets/app_store/th/ipad_13/01_home_2064x2752.png",
      "app-store-assets/play_store/en/phone/01_home_1080x1920.png",
      "app-store-assets/play_store/th/feature_graphic/01_bad_1024x500.png",
    ];
    const progress: number[] = [];
    const blob = await buildZip(paths.map((p) => entry(p)), (p) => progress.push(p.percent));
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const files = Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name).sort();
    expect(files).toEqual([...paths, "app-store-assets/manifest.json"].sort());

    const bytes = await zip.file(paths[0])!.async("uint8array");
    expect(bytes.length).toBe(100);
    expect(bytes[0]).toBe(7);

    const manifest = JSON.parse(await zip.file("app-store-assets/manifest.json")!.async("string"));
    expect(manifest.totals).toEqual({ files: 4, bytes: 400, compliant: 3 });
    expect(manifest.files[0]).toMatchObject({ path: paths[0], width: 1080, height: 1920, bytes: 100, type: "image/png" });
    expect(manifest.files[0].blob).toBeUndefined();

    expect(progress.length).toBeGreaterThan(0);
    expect(Math.max(...progress)).toBe(100);
  });

  it("refuses to build an empty archive", async () => {
    await expect(buildZip([])).rejects.toThrow(/Nothing to export/);
  });
});
