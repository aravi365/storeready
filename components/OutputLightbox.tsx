"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, Maximize, X, XCircle, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComplianceResult } from "@/utils/presets";

export interface LightboxItem {
  id: string;
  title: string;
  path: string;
  source: string;
  width: number;
  height: number;
  status: "queued" | "rendering" | "done" | "error";
  url?: string;
  fileName?: string;
  bytes?: number;
  format?: "png" | "jpeg";
  compliance?: ComplianceResult;
  /** Edge-extension checks */
  checks?: { label: string; ok: boolean }[];
  note?: string;
  error?: string;
}

const fmt = (n?: number) => (n === undefined ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`);

/**
 * Full-size preview of a generated file. Uses the native <dialog> element, so focus
 * trapping, Esc-to-close and the backdrop come from the browser.
 */
export function OutputLightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: LightboxItem[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [actualSize, setActualSize] = useState(false);
  const open = index !== null && index >= 0 && index < items.length;
  const item = open ? items[index] : null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex((index! + 1) % items.length);
      else if (e.key === "ArrowLeft") onIndex((index! - 1 + items.length) % items.length);
      else if (e.key === "0" || e.key === "z") setActualSize((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, items.length, onIndex]);

  return (
    <dialog
      ref={ref}
      aria-label="Generated image preview"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto h-[min(92vh,1100px)] w-[min(96vw,1400px)] max-w-none overflow-hidden rounded-2xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {item && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.title}</p>
              <p className="truncate font-mono text-xs text-muted-foreground" title={item.path}>
                {item.path}
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {index! + 1} / {items.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActualSize((v) => !v)}
              disabled={item.status !== "done"}
              aria-pressed={actualSize}
              title="Toggle 100% zoom (Z)"
            >
              {actualSize ? <Maximize /> : <ZoomIn />} {actualSize ? "Fit to window" : "100%"}
            </Button>
            {item.url && (
              <a
                href={item.url}
                download={item.fileName}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Download className="size-3.5" /> Download
              </a>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close preview">
              <X />
            </Button>
          </div>

          {/* Image */}
          <div className="relative min-h-0 flex-1 bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:24px_24px]">
            <div className={cn("absolute inset-0", actualSize ? "overflow-auto" : "flex items-center justify-center p-4")}>
              {item.status === "done" && item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={`${item.title}, ${item.width}×${item.height}`}
                  onClick={() => setActualSize((v) => !v)}
                  className={cn(
                    "shadow-lg",
                    actualSize ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain",
                  )}
                  style={actualSize ? { width: item.width, height: item.height } : undefined}
                />
              ) : item.status === "error" ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="size-4" /> {item.error ?? "Render failed"}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {item.status === "queued" ? "Queued…" : "Rendering…"}
                </p>
              )}
            </div>
            {items.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur"
                  onClick={() => onIndex((index! - 1 + items.length) % items.length)}
                  aria-label="Previous image"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur"
                  onClick={() => onIndex((index! + 1) % items.length)}
                  aria-label="Next image"
                >
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs">
            <span className="font-mono tabular-nums">
              {item.width}×{item.height}
            </span>
            {item.format && <span className="text-muted-foreground">{item.format.toUpperCase()}</span>}
            {item.bytes !== undefined && <span className="font-mono text-muted-foreground tabular-nums">{fmt(item.bytes)}</span>}
            <span className="truncate text-muted-foreground">from {item.source}</span>
            {item.compliance && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  item.compliance.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
                )}
              >
                {item.compliance.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                {item.compliance.ok ? "Compliant" : "Not compliant"}
              </span>
            )}
            {item.compliance?.checks.map((c) => (
              <span key={c.label} className={cn("text-muted-foreground", !c.ok && c.level !== "warn" && "text-destructive")}>
                {c.ok ? "✓" : c.level === "warn" ? "!" : "✗"} {c.label}
              </span>
            ))}
            {item.checks?.map((c) => (
              <span key={c.label} className={cn("text-muted-foreground", !c.ok && "text-amber-700 dark:text-amber-400")}>
                {c.ok ? "✓" : "!"} {c.label}
              </span>
            ))}
            {item.note && <span className="text-amber-700 dark:text-amber-400">{item.note}</span>}
            <span className="ml-auto hidden text-muted-foreground sm:inline">← → to browse · Z to zoom · Esc to close</span>
          </div>
        </div>
      )}
    </dialog>
  );
}
