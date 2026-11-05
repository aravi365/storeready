/**
 * Shared data for the Store Preview tab: the rendered screenshots, the app icon and the
 * listing text, published by the other tools. A tiny external store (no context needed).
 */
import { useSyncExternalStore } from "react";
import type { Listing } from "./listingRules";
import type { DeviceClass, Locale, Store } from "./presets";

export interface PreviewShot {
  jobId: string;
  store: Store;
  presetId: string;
  deviceClass: DeviceClass;
  category: "screenshot" | "feature_graphic";
  locale: Locale;
  width: number;
  height: number;
  url: string;
  /** Upload order of the source image (store listings show screenshots in this order) */
  order: number;
}

export interface PreviewData {
  shots: PreviewShot[];
  /** Rendered icon image URLs (App Store 1024 square, Play 512 square) */
  icon?: { apple: string; play: string };
  listings: Record<Locale, Listing>;
  company: string;
}

let state: PreviewData = { shots: [], listings: {}, company: "" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const previewStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setShots(shots: PreviewShot[]) {
    state = { ...state, shots };
    emit();
  },
  setIcon(icon: PreviewData["icon"]) {
    state = { ...state, icon };
    emit();
  },
  setListings(listings: Record<Locale, Listing>, company: string) {
    state = { ...state, listings, company };
    emit();
  },
};

const SERVER: PreviewData = { shots: [], listings: {}, company: "" };
export function usePreviewData(): PreviewData {
  return useSyncExternalStore(previewStore.subscribe, previewStore.get, () => SERVER);
}

// ───────────────────────── Selection (pure, tested) ─────────────────────────

export type PreviewDevice = "iphone" | "ipad" | "android-phone" | "android-tablet";

/** Preferred presets per device, best first (the stores show the largest set they have). */
const PREFERENCE: Record<PreviewDevice, string[]> = {
  iphone: ["as_iphone_69", "as_iphone_67", "as_iphone_63", "as_iphone_65"],
  ipad: ["as_ipad_13", "as_ipad_129"],
  "android-phone": ["gp_phone"],
  "android-tablet": ["gp_tablet_10", "gp_tablet_7", "gp_tablet_10_legacy", "gp_tablet_7_legacy"],
};

/** Screenshots a store page would show for a device + language, in listing order. */
export function shotsFor(shots: PreviewShot[], device: PreviewDevice, locale: Locale): PreviewShot[] {
  const mine = shots.filter((s) => s.locale === locale && s.category === "screenshot");
  for (const preset of PREFERENCE[device]) {
    const list = mine.filter((s) => s.presetId === preset);
    if (list.length) return list.sort((a, b) => a.order - b.order);
  }
  return [];
}

export function featureGraphicFor(shots: PreviewShot[], locale: Locale): PreviewShot | undefined {
  return shots.filter((s) => s.locale === locale && s.category === "feature_graphic").sort((a, b) => a.order - b.order)[0];
}

/** Languages that have something to preview, most screenshots first. */
export function previewLanguages(data: PreviewData): Locale[] {
  const counts = new Map<Locale, number>();
  for (const s of data.shots) counts.set(s.locale, (counts.get(s.locale) ?? 0) + 1);
  for (const l of Object.keys(data.listings)) if (!counts.has(l)) counts.set(l, 0);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}
