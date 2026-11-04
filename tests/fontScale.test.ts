import { describe, expect, it } from "vitest";
import { FONT_SCALES, FONT_SCALE_BOOT, FONT_SCALE_KEY, parseFontScale } from "@/lib/fontScale";

describe("parseFontScale", () => {
  it("accepts only the defined steps", () => {
    for (const s of FONT_SCALES) expect(parseFontScale(String(s))).toBe(s);
  });
  it.each([null, "", "abc", "2", "0.5", "1.1", "-1"])("falls back to 100%% for %s", (raw) => {
    expect(parseFontScale(raw)).toBe(1);
  });
  it("includes 100% and only grows or shrinks in small steps", () => {
    expect(FONT_SCALES).toContain(1);
    expect([...FONT_SCALES]).toEqual([...FONT_SCALES].sort());
  });
});

describe("FONT_SCALE_BOOT (runs before paint)", () => {
  const run = (stored: string | null, throws = false) => {
    const html = { style: { fontSize: "" } };
    const localStorage = { getItem: (k: string) => { if (throws) throw new Error("blocked"); return k === FONT_SCALE_KEY ? stored : null; } };
    new Function("localStorage", "document", FONT_SCALE_BOOT)(localStorage, { documentElement: html });
    return html.style.fontSize;
  };
  it("applies a saved step", () => expect(run("1.25")).toBe("125%"));
  it("leaves 100% and invalid values alone", () => {
    expect(run("1")).toBe("");
    expect(run("9")).toBe("");
    expect(run(null)).toBe("");
  });
  it("never throws when storage is blocked", () => expect(run(null, true)).toBe(""));
});
