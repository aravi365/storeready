"use client";

import { useCallback, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { FONT_SCALES, FONT_SCALE_KEY, parseFontScale } from "@/lib/fontScale";

const EVENT = "storeshot:font-scale";

function readScale(): number {
  try {
    return parseFontScale(localStorage.getItem(FONT_SCALE_KEY));
  } catch {
    return 1;
  }
}

function applyFontScale(scale: number) {
  document.documentElement.style.fontSize = scale === 1 ? "" : `${scale * 100}%`;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function FontSizeControl() {
  const scale = useSyncExternalStore(subscribe, readScale, () => 1);
  const i = FONT_SCALES.indexOf(scale as (typeof FONT_SCALES)[number]);

  const setScale = useCallback((next: number) => {
    try {
      if (next === 1) localStorage.removeItem(FONT_SCALE_KEY);
      else localStorage.setItem(FONT_SCALE_KEY, String(next));
    } catch {
      /* private mode: still apply for this visit */
    }
    applyFontScale(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  // Read the live value at click time, so fast repeated clicks each move one step.
  const step = useCallback(
    (dir: 1 | -1) => {
      const at = FONT_SCALES.indexOf(readScale() as (typeof FONT_SCALES)[number]);
      const next = FONT_SCALES[Math.min(FONT_SCALES.length - 1, Math.max(0, at + dir))];
      setScale(next);
    },
    [setScale],
  );

  const btn =
    "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 font-medium text-muted-foreground transition hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div role="group" aria-label="Text size" className="flex items-center rounded-lg border bg-muted/50 p-0.5">
      <button
        type="button"
        className={cn(btn, "text-xs")}
        onClick={() => step(-1)}
        disabled={i <= 0}
        aria-label="Decrease text size"
        title="Smaller text"
      >
        A−
      </button>
      <button
        type="button"
        className={cn(btn, "min-w-11 text-[11px] tabular-nums", scale !== 1 && "text-foreground")}
        onClick={() => setScale(1)}
        aria-label={`Text size ${Math.round(scale * 100)}%. Reset to 100%`}
        title="Reset text size"
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        type="button"
        className={cn(btn, "text-sm")}
        onClick={() => step(1)}
        disabled={i >= FONT_SCALES.length - 1}
        aria-label="Increase text size"
        title="Larger text"
      >
        A+
      </button>
    </div>
  );
}
