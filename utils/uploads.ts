/**
 * Upload filtering for mixed batches (dropped folders can contain anything).
 * Pure functions, so they can be unit-tested without a browser.
 */
import { ACCEPTED_TYPES, MAX_INPUT_BYTES } from "./canvasResizer";

const IMAGE_EXT = /\.(png|jpe?g)$/i;

/** Path inside the dropped/picked folder (e.g. "th/ipad/01.png"), or just the file name. */
export function relPathOf(f: File): string {
  const x = f as File & { path?: string; relativePath?: string };
  return (x.relativePath || x.webkitRelativePath || x.path || f.name).replace(/^\.?\//, "");
}

/** Hidden/system files: dot-files or dot-folders, macOS __MACOSX, Windows thumbs.db / desktop.ini. */
export function isHiddenPath(path: string): boolean {
  const segs = path.split("/");
  const name = segs.at(-1) ?? "";
  return segs.some((seg) => seg.startsWith(".") || seg === "__MACOSX") || /^(thumbs\.db|desktop\.ini)$/i.test(name);
}

export function isAcceptedImage(f: Pick<File, "type" | "name">): boolean {
  return ACCEPTED_TYPES.includes(f.type) || (!f.type && IMAGE_EXT.test(f.name));
}

export interface UploadPartition {
  /** Accepted images, naturally sorted by folder path (2.png before 10.png) */
  images: File[];
  wrongType: number;
  tooBig: number;
  hidden: number;
  /** Number of distinct folders the accepted images came from */
  folders: number;
}

export function partitionUploads(files: File[], maxBytes = MAX_INPUT_BYTES): UploadPartition {
  const images: File[] = [];
  let wrongType = 0;
  let tooBig = 0;
  let hidden = 0;
  for (const f of files) {
    if (isHiddenPath(relPathOf(f))) hidden++;
    else if (!isAcceptedImage(f)) wrongType++;
    else if (f.size > maxBytes) tooBig++;
    else images.push(f);
  }
  images.sort((a, b) => relPathOf(a).localeCompare(relPathOf(b), undefined, { numeric: true, sensitivity: "base" }));
  const folders = new Set(images.map((f) => relPathOf(f).split("/").slice(0, -1).join("/")).filter(Boolean)).size;
  return { images, wrongType, tooBig, hidden, folders };
}
