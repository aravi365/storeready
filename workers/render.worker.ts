/// <reference lib="webworker" />
import { decodeImage, renderToBlob, type EncodeOptions, type RenderOptions } from "@/utils/canvasResizer";
import type { Size } from "@/utils/presets";

export type WorkerRequest = {
  type: "render";
  assetId: string;
  file: Blob;
  jobs: { id: string; size: Size; opts: RenderOptions; enc: EncodeOptions }[];
};

export type WorkerResponse =
  | { type: "result"; jobId: string; blob: Blob; format: "png" | "jpeg"; width: number; height: number; note?: string }
  | { type: "job-error"; jobId: string; message: string }
  | { type: "asset-error"; assetId: string; message: string }
  | { type: "asset-done"; assetId: string };

const post = (msg: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { assetId, file, jobs } = e.data;
  let bmp: ImageBitmap | undefined;
  try {
    bmp = await decodeImage(file);
  } catch (err) {
    post({ type: "asset-error", assetId, message: (err as Error).message });
    return;
  }
  for (const job of jobs) {
    try {
      const r = await renderToBlob(bmp, job.size, job.opts, job.enc);
      post({ type: "result", jobId: job.id, blob: r.blob, format: r.format, width: r.width, height: r.height, note: r.note });
    } catch (err) {
      post({ type: "job-error", jobId: job.id, message: (err as Error).message || "Render failed" });
    }
  }
  bmp.close();
  post({ type: "asset-done", assetId });
};
