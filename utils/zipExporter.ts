/**
 * Bundles rendered assets into a store-ready ZIP:
 *
 *   app-store-assets/
 *     app_store/<locale>/<iphone_6.9|ipad_13|…>/NN_name_WxH.png
 *     play_store/<locale>/<phone|tablet_10in|feature_graphic|…>/NN_name_WxH.png
 *     manifest.json   – every file with size, dimensions and compliance checks
 */
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ComplianceResult } from "./presets";

export interface ZipEntry {
  path: string;
  blob: Blob;
  width: number;
  height: number;
  store: string;
  locale: string;
  preset: string;
  source: string;
  compliance: ComplianceResult;
  note?: string;
}

export interface ZipProgress {
  phase: "packing" | "compressing";
  percent: number;
  currentFile?: string;
}

export async function buildZip(entries: ZipEntry[], onProgress?: (p: ZipProgress) => void): Promise<Blob> {
  if (!entries.length) throw new Error("Nothing to export — enable at least one preset and locale.");
  const zip = new JSZip();

  entries.forEach((e, i) => {
    // PNG/JPEG are already compressed; STORE avoids burning CPU for ~0% gain.
    zip.file(e.path, e.blob, { compression: "STORE", binary: true });
    onProgress?.({ phase: "packing", percent: ((i + 1) / entries.length) * 100, currentFile: e.path });
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: "StoreShot",
    totals: {
      files: entries.length,
      bytes: entries.reduce((n, e) => n + e.blob.size, 0),
      compliant: entries.filter((e) => e.compliance.ok).length,
    },
    files: entries.map(({ blob, ...rest }) => ({ ...rest, bytes: blob.size, type: blob.type })),
  };
  zip.file("app-store-assets/manifest.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 }, streamFiles: true },
    (meta) => onProgress?.({ phase: "compressing", percent: meta.percent, currentFile: meta.currentFile ?? undefined }),
  );
}

export async function exportZip(
  entries: ZipEntry[],
  onProgress?: (p: ZipProgress) => void,
  fileName = `app-store-assets-${new Date().toISOString().slice(0, 10)}.zip`,
): Promise<{ bytes: number; fileName: string }> {
  const blob = await buildZip(entries, onProgress);
  saveAs(blob, fileName);
  return { bytes: blob.size, fileName };
}
