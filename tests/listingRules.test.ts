import { describe, expect, it } from "vitest";
import {
  EMPTY_LISTING,
  FIELDS,
  byteCount,
  charCount,
  findEmoji,
  fixAll,
  lintListing,
  normalizeKeywords,
  removeSentences,
  removeTerms,
  stripEmoji,
  stripHtml,
  trimToLimit,
  wordRe,
  OTHER_PLATFORMS,
  type FieldId,
  type Listing,
} from "@/utils/listingRules";

const L = (p: Partial<Listing>): Listing => ({ ...EMPTY_LISTING, ...p });
const issues = (p: Partial<Listing>, ctx = {}) => lintListing(L(p), ctx);
const on = (p: Partial<Listing>, field: FieldId, ctx = {}) => issues(p, ctx).filter((i) => i.field === field);
const rules = (p: Partial<Listing>, field: FieldId) => on(p, field).map((i) => `${i.level}:${i.rule}`);
const fix = (p: Partial<Listing>, field: FieldId, rule: string) => {
  const i = on(p, field).find((x) => x.rule === rule && x.fix)!;
  expect(i, `no fixable ${rule} on ${field}`).toBeTruthy();
  return i.fix!(L(p)[field]);
};

describe("field limits match the stores", () => {
  it("has the published limits", () => {
    expect(Object.fromEntries(FIELDS.map((f) => [f.id, `${f.limit} ${f.unit}`]))).toEqual({
      "apple.name": "30 chars",
      "apple.subtitle": "30 chars",
      "apple.promo": "170 chars",
      "apple.description": "4000 chars",
      "apple.keywords": "100 bytes",
      "apple.whatsNew": "4000 chars",
      "play.title": "30 chars",
      "play.short": "80 chars",
      "play.full": "4000 chars",
    });
  });

  it("flags and trims over-limit fields at a word boundary", () => {
    const name = "Budget Planner and Expense Tracker Pro";
    expect(rules({ "apple.name": name }, "apple.name")).toContain("error:App Store Connect");
    const fixed = fix({ "apple.name": name }, "apple.name", "App Store Connect");
    expect(charCount(fixed)).toBeLessThanOrEqual(30);
    expect(fixed).toBe("Budget Planner and Expense");
    expect(on({ "apple.name": "Budget Planner" }, "apple.name")).toEqual([]);
  });

  it("counts Thai and emoji as people see them, and keywords in bytes", () => {
    expect(charCount("งบประมาณ")).toBe(8);
    expect(byteCount("งบประมาณ")).toBe(24); // 3 bytes per Thai character in UTF-8
    const thai = Array(5).fill("งบประมาณ").join(","); // 44 chars, 124 bytes
    expect(rules({ "apple.keywords": thai }, "apple.keywords")).toContain("error:App Store Connect");
    expect(byteCount(fix({ "apple.keywords": thai }, "apple.keywords", "App Store Connect"))).toBeLessThanOrEqual(100);
  });

  it("app name needs at least 2 characters", () => {
    expect(on({ "apple.name": "A" }, "apple.name").some((i) => i.message.includes("at least 2"))).toBe(true);
  });
});

describe("Apple 2.3.10: other platforms", () => {
  it.each([
    "Available on iOS and Android.",
    "Download from Google Play too!",
    "Also on the Play Store.",
    "Get the APK here.",
    "Works on Huawei AppGallery.",
  ])("flags %s", (text) => {
    expect(rules({ "apple.description": text }, "apple.description")).toContain("error:Apple 2.3.10");
  });

  it("doesn't flag words that merely contain the letters", () => {
    expect(rules({ "apple.description": "An androidal robot? No. Apkallu myths." }, "apple.description")).not.toContain("error:Apple 2.3.10");
  });

  it("removes whole sentences from descriptions", () => {
    const text = "Track every baht. Available on iPhone and Android. Sync across devices.";
    expect(fix({ "apple.description": text }, "apple.description", "Apple 2.3.10")).toBe("Track every baht. Sync across devices.");
  });

  it("keeps bullet lines intact when removing one", () => {
    const text = "Features:\n• Budgets\n• Works with Android Auto\n• Reports";
    expect(fix({ "apple.description": text }, "apple.description", "Apple 2.3.10")).toBe("Features:\n• Budgets\n• Reports");
  });

  it("removes just the words (and a dangling 'and') in the subtitle", () => {
    expect(fix({ "apple.subtitle": "Budgets for iOS & Android" }, "apple.subtitle", "Apple 2.3.10")).toBe("Budgets for iOS");
  });

  it("drops platform keywords", () => {
    expect(fix({ "apple.keywords": "budget,android,expense" }, "apple.keywords", "Apple 2.3.10")).toBe("budget,expense");
  });
});

describe("Apple 2.3.7: prices, claims, brands", () => {
  it("flags prices in the name, subtitle and keywords", () => {
    expect(rules({ "apple.name": "Budget Free" }, "apple.name")).toContain("error:Apple 2.3.7");
    expect(rules({ "apple.subtitle": "50% off this week" }, "apple.subtitle")).toContain("error:Apple 2.3.7");
    expect(rules({ "apple.keywords": "budget,free,sale" }, "apple.keywords")).toContain("error:Apple 2.3.7");
    expect(rules({ "apple.subtitle": "Only $0.99" }, "apple.subtitle")).toContain("error:Apple 2.3.7");
  });

  it("does not treat 'ad-free' or 'hands-free' as pricing", () => {
    expect(rules({ "apple.subtitle": "Ad-free, hands-free budgets" }, "apple.subtitle")).not.toContain("error:Apple 2.3.7");
  });

  it("allows prices in the description", () => {
    expect(rules({ "apple.description": "Free to download." }, "apple.description")).not.toContain("error:Apple 2.3.7");
  });

  it("unverifiable claims: error in subtitle, warning in name", () => {
    expect(rules({ "apple.subtitle": "The #1 budget app" }, "apple.subtitle")).toContain("error:Apple 2.3.7");
    expect(rules({ "apple.name": "Best Budget" }, "apple.name")).toContain("warning:Apple 2.3.7");
    expect(fix({ "apple.subtitle": "The best budget app" }, "apple.subtitle", "Apple 2.3.7")).toBe("The budget app");
  });

  it("other apps in subtitle and keywords", () => {
    expect(rules({ "apple.subtitle": "Like Instagram for money" }, "apple.subtitle")).toContain("error:Apple 2.3.7");
    expect(fix({ "apple.keywords": "budget,tiktok,expense" }, "apple.keywords", "Apple 2.3.7")).toBe("budget,expense");
  });
});

describe("Apple: other guideline checks", () => {
  it("placeholder text (2.1)", () => {
    for (const t of ["Lorem ipsum dolor", "Coming TODO", "Welcome to [App Name]!", "Hi {{name}}"]) {
      expect(rules({ "apple.description": t }, "apple.description")).toContain("error:Apple 2.1");
    }
  });
  it("beta / demo wording (2.2)", () => {
    expect(rules({ "apple.description": "This beta version is limited." }, "apple.description")).toContain("warning:Apple 2.2");
    expect(rules({ "apple.description": "Better budgets." }, "apple.description")).not.toContain("warning:Apple 2.2");
  });
  it("Apple endorsement (5.2.4)", () => {
    expect(rules({ "apple.promo": "Apple approved budgeting!" }, "apple.promo")).toContain("error:Apple 5.2.4");
  });
  it("'For Kids' is reserved (2.3.8)", () => {
    expect(rules({ "apple.subtitle": "Budgets for Kids" }, "apple.subtitle")).toContain("warning:Apple 2.3.8");
  });
  it("HTML in the description is converted to plain text", () => {
    const html = "<p><b>Budgets</b> made easy.</p><ul><li>Fast</li><li>Private</li></ul>Tom &amp; Jerry&nbsp;approved";
    expect(rules({ "apple.description": html }, "apple.description")).toContain("error:App Store Connect");
    expect(fix({ "apple.description": html }, "apple.description", "App Store Connect")).toBe("Budgets made easy.\n\n• Fast\n• Private\n\nTom & Jerry approved");
  });
});

describe("emoji", () => {
  it("detects emoji including flags, skin tones, ZWJ sequences, keycaps and emoticons", () => {
    expect(findEmoji("Hi 👋🏽 🇹🇭 👨‍👩‍👧 1️⃣ ✨ :) <3")).toHaveLength(7);
    expect(findEmoji("Plain text, 100% ok — ™ ©")).toEqual([]);
  });
  it("Apple: emoji are allowed (info), with an optional remove", () => {
    const r = on({ "apple.description": "Save money 💰 fast ✨" }, "apple.description").find((i) => i.rule === "Apple 4.5.6")!;
    expect(r.level).toBe("info");
    expect(r.fix!("Save money 💰 fast ✨")).toBe("Save money fast");
  });
  it("Google Play: emoji in the title is an error", () => {
    expect(rules({ "play.title": "Budget 💰 Planner" }, "play.title")).toContain("error:Play metadata");
    expect(fix({ "play.title": "💰 Budget Planner 🚀" }, "play.title", "Play metadata")).toBe("Budget Planner");
  });
  it("stripEmoji keeps Thai text and line breaks", () => {
    expect(stripEmoji("งบประมาณ 💸\n• บันทึก ✅")).toBe("งบประมาณ\n• บันทึก");
  });
});

describe("Apple keywords", () => {
  it("removes spaces, duplicates and short keywords", () => {
    expect(normalizeKeywords("budget, Budget , ab, expense tracker,  money")).toBe("budget,expense tracker,money");
  });
  it("flags each problem with the right level", () => {
    const r = rules({ "apple.keywords": "budget, budget, ab" }, "apple.keywords");
    expect(r).toEqual(expect.arrayContaining(["error:App Store Connect", "warning:App Store Connect", "info:App Store Connect"]));
  });
  it("words of the app name count too, but only whole keywords", () => {
    const p = { "apple.name": "Penny Budget – for iOS", "apple.keywords": "penny,budget,budget planner,expense" };
    const i = on(p, "apple.keywords").find((x) => x.message.includes("already searchable"))!;
    expect(i.match).toBe("penny, budget");
    expect(i.fix!(p["apple.keywords"])).toBe("budget planner,expense");
  });

  it("don't repeat the app or company name", () => {
    const r = on({ "apple.name": "Penny", "apple.keywords": "penny,budget" }, "apple.keywords", { company: "Acme Labs" });
    expect(r.some((i) => i.message.includes("already searchable"))).toBe(true);
    expect(normalizeKeywords("penny,budget,acme labs", { drop: wordRe(["Penny", "Acme Labs"]) })).toBe("budget");
  });
  it("trims to 100 bytes on a whole keyword", () => {
    const many = Array.from({ length: 30 }, (_, i) => `keyword${i}`).join(",");
    const out = normalizeKeywords(many);
    expect(byteCount(out)).toBeLessThanOrEqual(100);
    expect(out.endsWith(",")).toBe(false);
    expect(out.split(",").every((k) => /^keyword\d+$/.test(k))).toBe(true);
  });
});

describe("Google Play title", () => {
  it.each([
    ["#1 Budget App", "ranking"],
    ["Budget: App of the Year", "ranking"],
    ["Budget Planner 50% OFF", "price"],
    ["Free Budget Planner", "price"],
    ["Budget!!! Planner", "repeated"],
    ["Budget ★★★ Planner", "repeated"],
  ])("%s is an error (%s)", (title) => {
    expect(rules({ "play.title": title }, "play.title")).toContain("error:Play metadata");
  });

  it("Editor's Choice / New and calls to action warn", () => {
    expect(rules({ "play.title": "Budget - Editor's Choice" }, "play.title")).toContain("warning:Play metadata");
    expect(rules({ "play.title": "Budget Download Now" }, "play.title")).toContain("warning:Play metadata");
    expect(rules({ "play.title": "New Budget" }, "play.title")).toContain("warning:Play metadata");
  });

  it("ALL CAPS warns and converts to title case", () => {
    expect(rules({ "play.title": "BUDGET PLANNER" }, "play.title")).toContain("warning:Play metadata");
    const i = on({ "play.title": "BUDGET PLANNER" }, "play.title").find((x) => x.message.includes("ALL CAPS"))!;
    expect(i.fix!("BUDGET PLANNER")).toBe("Budget Planner");
    expect(on({ "play.title": "Budget Planner" }, "play.title")).toEqual([]);
  });

  it("a clean title has no issues", () => {
    expect(on({ "play.title": "Penny: Budget Planner" }, "play.title")).toEqual([]);
  });
});

describe("Google Play descriptions", () => {
  it("repetitive keywords warn", () => {
    const stuffed = "Budget app. ".repeat(3) + Array(8).fill("budget tracker budget planner budget").join(" ");
    expect(rules({ "play.full": stuffed }, "play.full")).toContain("warning:Play metadata");
    expect(rules({ "play.full": "Plan your monthly budget and track spending in one place." }, "play.full")).toEqual([]);
  });

  it("unattributed testimonials warn; attributed ones don't", () => {
    expect(rules({ "play.full": "Great app.\n“The best budgeting app I have used!”" }, "play.full")).toContain("warning:Play metadata");
    expect(rules({ "play.full": "★★★★★ Amazing" }, "play.full")).toContain("warning:Play metadata");
    expect(rules({ "play.full": "“A smart way to budget.” — The Daily Tech" }, "play.full")).not.toContain("warning:Play metadata");
  });

  it("mentions of iPhone are only an info note on Play", () => {
    expect(rules({ "play.short": "Also on iPhone" }, "play.short")).toEqual(["info:Play metadata"]);
  });
});

describe("fixers", () => {
  it("trimToLimit never cuts mid-word and handles one long word", () => {
    expect(trimToLimit("hello wonderful world", 12)).toBe("hello");
    expect(trimToLimit("supercalifragilistic", 5)).toBe("super");
    expect(trimToLimit("short", 30)).toBe("short");
  });
  it("removeTerms tidies separators", () => {
    expect(removeTerms("Budgets – Android", wordRe(OTHER_PLATFORMS))).toBe("Budgets");
    expect(removeTerms("iOS and Android app", wordRe(OTHER_PLATFORMS))).toBe("iOS app");
  });
  it("removeSentences keeps the rest", () => {
    expect(removeSentences("One. Two Android. Three!", wordRe(OTHER_PLATFORMS))).toBe("One. Three!");
  });
  it("stripHtml handles <br> and entities", () => {
    expect(stripHtml("Line one<br>Line&nbsp;two &lt;3")).toBe("Line one\nLine two <3");
  });
});

describe("fixAll ordering (regressions from the built-in example)", () => {
  it("removes words before trimming, and never leaves a dangling '&'", () => {
    const { listing } = fixAll(L({ "apple.name": "Penny Budget – FREE for iOS & Android" }));
    expect(listing["apple.name"]).toBe("Penny Budget – for iOS");
  });

  it("converts HTML before removing sentences, so neighbouring sentences survive", () => {
    const { listing } = fixAll(L({ "apple.description": "<b>Penny</b> helps you plan budgets.<br>Available on iPhone and Android.\n\n• Track spending" }));
    expect(listing["apple.description"]).toBe("Penny helps you plan budgets.\n\n• Track spending");
  });

  it("trimToLimit drops trailing joiners", () => {
    expect(trimToLimit("Budgets for iOS & Android tablets", 18)).toBe("Budgets for iOS");
    expect(trimToLimit("Plan budgets and", 30)).toBe("Plan budgets and"); // under the limit: untouched
  });

  it("flags 'best … ever' with words in between", () => {
    expect(rules({ "play.short": "The best budget planner ever!" }, "play.short")).toContain("warning:Play metadata");
  });
});

describe("fixAll", () => {
  it("fixes errors and warnings across fields, leaves info and unfixable issues alone", () => {
    const dirty = L({
      "apple.name": "Penny Budget Free – Android",
      "apple.subtitle": "The #1 budget app 💰",
      "apple.description": "<b>Save</b> money. Also on Google Play. Lorem ipsum.",
      "apple.keywords": "budget, budget, android, tiktok, ab",
      "play.title": "💰 #1 BUDGET APP!!!",
    });
    const { listing, applied } = fixAll(dirty);
    expect(applied).toBeGreaterThan(5);
    expect(listing["apple.name"]).toBe("Penny Budget");
    expect(listing["apple.subtitle"]).toBe("The budget app 💰"); // emoji are allowed on Apple (info only)
    expect(listing["apple.keywords"]).toBe(""); // "budget" is also a word of the app name, so it's already searchable
    expect(listing["apple.description"]).toBe("Save money. Lorem ipsum."); // placeholder has no auto-fix: flagged for you
    expect(listing["play.title"]).not.toMatch(/💰|#1|!!!/);
    const left = lintListing(listing).filter((i) => i.level !== "info");
    expect(left.map((i) => i.rule)).toEqual(["Apple 2.1"]);
  });

  it("is a no-op on clean text", () => {
    const clean = L({ "apple.name": "Penny", "apple.subtitle": "Simple monthly budgets", "play.title": "Penny: Budget Planner" });
    expect(fixAll(clean)).toEqual({ listing: clean, applied: 0 });
  });
});
