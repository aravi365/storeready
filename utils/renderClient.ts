/**
 * Runs render jobs in a Web Worker (off the main thread) and falls back to the
 * main thread when workers/OffscreenCanvas aren't available.
 */
import { decodeImage, renderToBlob, type RenderResult } from "./canvasResizer";
import type { Asset, Job } from "./jobs";
import type { WorkerRequest, WorkerResponse } from "@/workers/render.worker";

export type JobOutcome = { ok: true; result: RenderResult } | { ok: false; error: string };

export interface RunCallbacks {
  onJob: (job: Job, outcome: JobOutcome) => void | Promise<void>;
  signal?: AbortSignal;
}

function canUseWorker() {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

export async function runJobs(assets: Asset[], jobs: Job[], cb: RunCallbacks): Promise<void> {
  const byAsset = new Map<string, Job[]>();
  for (const j of jobs) byAsset.set(j.assetId, [...(byAsset.get(j.assetId) ?? []), j]);
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  let worker: Worker | null = null;
  if (canUseWorker()) {
    try {
      // Pre-bundled by `npm run build:worker` (esbuild) into public/, so it ships as plain JS.
      worker = new Worker(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/render.worker.js`, { type: "module" });
    } catch {
      worker = null;
    }
  }

  try {
    for (const [assetId, list] of byAsset) {
      if (cb.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      const asset = assetMap.get(assetId)!;
      if (worker) {
        try {
          await runInWorker(worker, asset, list, cb);
          continue;
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
          // Worker failed to load or crashed: finish on the main thread instead.
          worker.terminate();
          worker = null;
        }
      }
      await runOnMain(asset, list, cb);
    }
  } finally {
    worker?.terminate();
  }
}

function runInWorker(worker: Worker, asset: Asset, list: Job[], cb: RunCallbacks) {
  const jobMap = new Map(list.map((j) => [j.id, j]));
  const pending: Promise<void>[] = [];
  const settle = (resolve: () => void) => Promise.all(pending).then(() => resolve());
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Export cancelled", "AbortError"));
    };
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      cb.signal?.removeEventListener("abort", onAbort);
    };
    const onError = (e: ErrorEvent) => {
      cleanup();
      reject(new Error(e.message || "Render worker crashed (possibly out of memory)."));
    };
    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      if (m.type === "result") {
        const { jobId, blob, format, width, height, note } = m;
        const result = { blob, format, width, height, note };
        pending.push(Promise.resolve(cb.onJob(jobMap.get(jobId)!, { ok: true, result })));
      } else if (m.type === "job-error") {
        pending.push(Promise.resolve(cb.onJob(jobMap.get(m.jobId)!, { ok: false, error: m.message })));
      } else if (m.type === "asset-error") {
        for (const j of list) pending.push(Promise.resolve(cb.onJob(j, { ok: false, error: m.message })));
        cleanup();
        settle(resolve);
      } else if (m.type === "asset-done") {
        cleanup();
        settle(resolve);
      }
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    cb.signal?.addEventListener("abort", onAbort);
    const req: WorkerRequest = {
      type: "render",
      assetId: asset.id,
      file: asset.file,
      jobs: list.map(({ id, size, opts, enc }) => ({ id, size, opts, enc })),
    };
    worker.postMessage(req);
  });
}

async function runOnMain(asset: Asset, list: Job[], cb: RunCallbacks) {
  let bmp: ImageBitmap;
  try {
    bmp = await decodeImage(asset.file);
  } catch (err) {
    for (const j of list) await cb.onJob(j, { ok: false, error: (err as Error).message });
    return;
  }
  for (const job of list) {
    if (cb.signal?.aborted) break;
    try {
      const result = await renderToBlob(bmp, job.size, job.opts, job.enc);
      await cb.onJob(job, { ok: true, result });
    } catch (err) {
      await cb.onJob(job, { ok: false, error: (err as Error).message });
    }
    await new Promise((r) => setTimeout(r, 0)); // yield to keep the UI responsive
  }
  bmp.close();
}
