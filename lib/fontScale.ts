/** Text size steps, applied as the root font size so every rem-based size scales. */
export const FONT_SCALES = [0.875, 1, 1.125, 1.25, 1.375] as const;
export const FONT_SCALE_KEY = "storeshot:font-scale";
/** Default root size: 17px (106.25% of the browser's 16px). The text-size steps multiply this. */
export const BASE_FONT_PERCENT = 106.25;

/** Root font-size CSS value for a step; "" means use the stylesheet default. */
export const rootFontSize = (scale: number) => (scale === 1 ? "" : `${BASE_FONT_PERCENT * scale}%`);

/** Returns a saved scale only if it's one of the allowed steps; anything else means 100%. */
export function parseFontScale(raw: string | null): number {
  const v = Number(raw);
  return (FONT_SCALES as readonly number[]).includes(v) ? v : 1;
}

/**
 * Runs before first paint (inlined in <head>) so a saved size never flashes.
 * A string because it must run before the JS bundle loads.
 */
export const FONT_SCALE_BOOT = `try{var s=Number(localStorage.getItem(${JSON.stringify(FONT_SCALE_KEY)}));if([${FONT_SCALES.join(",")}].indexOf(s)>-1&&s!==1)document.documentElement.style.fontSize=s*${BASE_FONT_PERCENT}+"%"}catch(e){}`;
