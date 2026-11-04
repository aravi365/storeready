/**
 * App Store / Google Play listing-text checker and auto-fixers.
 *
 * Sources (checked 2026-11-05):
 *  Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
 *   2.1  placeholder text must be scrubbed · 2.2 no demos/betas/trials · 2.3.7 name ≤30, no prices,
 *   trademarked terms, popular app names or irrelevant phrases; subtitle: no references to other apps
 *   or unverifiable claims · 2.3.8 "For Kids"/"For Children" reserved for the Kids Category ·
 *   2.3.10 no names of other mobile platforms or app marketplaces · 4.5.6 emoji ARE allowed in
 *   metadata · 5.2.4 don't imply Apple endorsement
 *  App Store Connect field reference: name 2–30, subtitle 30, promotional text 170, description 4000
 *   (plain text, HTML not supported), keywords 100 bytes (each keyword > 2 characters; don't repeat the
 *   app or company name; no names of other apps or companies), What's New 4000
 *  Google Play Metadata policy: https://support.google.com/googleplay/android-developer/answer/9898842
 *   title ≤30; no emojis, emoticons or repeated special characters in title; no ALL CAPS unless brand;
 *   no store performance/ranking ("#1", "App of the year", "Best of Play"), price/promotion ("10% off"),
 *   or Play programs ("Editor's choice", "New") in the title; no repetitive keywords, deceptive claims
 *   ("best game ever") or unattributed testimonials in descriptions
 *  Play Console listing limits: title 30, short description 80, full description 4000
 */

export type FieldId =
  | "apple.name"
  | "apple.subtitle"
  | "apple.promo"
  | "apple.description"
  | "apple.keywords"
  | "apple.whatsNew"
  | "play.title"
  | "play.short"
  | "play.full";

export type Listing = Record<FieldId, string>;

export const EMPTY_LISTING: Listing = {
  "apple.name": "",
  "apple.subtitle": "",
  "apple.promo": "",
  "apple.description": "",
  "apple.keywords": "",
  "apple.whatsNew": "",
  "play.title": "",
  "play.short": "",
  "play.full": "",
};

export interface FieldSpec {
  id: FieldId;
  store: "apple" | "play";
  label: string;
  limit: number;
  unit: "chars" | "bytes";
  multiline: boolean;
  help: string;
  /** fastlane metadata file name */
  fastlane: string;
}

export const FIELDS: FieldSpec[] = [
  { id: "apple.name", store: "apple", label: "App name", limit: 30, unit: "chars", multiline: false, help: "2–30 characters.", fastlane: "name.txt" },
  { id: "apple.subtitle", store: "apple", label: "Subtitle", limit: 30, unit: "chars", multiline: false, help: "Shown under the name. No references to other apps or unverifiable claims.", fastlane: "subtitle.txt" },
  { id: "apple.promo", store: "apple", label: "Promotional text", limit: 170, unit: "chars", multiline: true, help: "Above the description; can change without a new submission.", fastlane: "promotional_text.txt" },
  { id: "apple.description", store: "apple", label: "Description", limit: 4000, unit: "chars", multiline: true, help: "Plain text with line breaks. HTML isn't supported.", fastlane: "description.txt" },
  { id: "apple.keywords", store: "apple", label: "Keywords", limit: 100, unit: "bytes", multiline: false, help: "Comma-separated, 100 bytes. Each keyword 3+ characters. Don't repeat your app or company name.", fastlane: "keywords.txt" },
  { id: "apple.whatsNew", store: "apple", label: "What's New", limit: 4000, unit: "chars", multiline: true, help: "Describe what changed in this version.", fastlane: "release_notes.txt" },
  { id: "play.title", store: "play", label: "App name", limit: 30, unit: "chars", multiline: false, help: "No emojis, ranking, price or promotional terms.", fastlane: "title.txt" },
  { id: "play.short", store: "play", label: "Short description", limit: 80, unit: "chars", multiline: false, help: "The first text people see on your listing.", fastlane: "short_description.txt" },
  { id: "play.full", store: "play", label: "Full description", limit: 4000, unit: "chars", multiline: true, help: "No repetitive keywords or unattributed testimonials.", fastlane: "full_description.txt" },
];

export const FIELD_BY_ID = Object.fromEntries(FIELDS.map((f) => [f.id, f])) as Record<FieldId, FieldSpec>;

export type Level = "error" | "warning" | "info";

export interface Issue {
  id: string;
  field: FieldId;
  level: Level;
  /** Guideline reference, e.g. "Apple 2.3.10" */
  rule: string;
  message: string;
  /** The offending text, for display */
  match?: string;
  fixLabel?: string;
  fix?: (text: string) => string;
}

// ───────────────────────── Text helpers ─────────────────────────

/** Characters as people count them (grapheme-ish: code points). */
export const charCount = (s: string) => [...s].length;
export const byteCount = (s: string) => new TextEncoder().encode(s).length;
export const measure = (s: string, unit: "chars" | "bytes") => (unit === "bytes" ? byteCount(s) : charCount(s));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word, case-insensitive matcher that works for any script. */
export const wordRe = (terms: string[], extraFlags = "") =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms.map(escape).join("|")})(?![\\p{L}\\p{N}])`, `giu${extraFlags}`);

// One match per visible emoji: keycaps, flags (two regional indicators), and pictographs with
// skin tones / variation selectors / ZWJ joins. \u00A9, \u00AE and \u2122 are text symbols, not emoji.
const PICTO = String.raw`(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}]?\uFE0F?`;
const EMOJI_RE = new RegExp(
  String.raw`[0-9#*]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|` +
    `${PICTO}(?:\\u200D${PICTO})*` +
    String.raw`|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}]`,
  "gu",
);
const EMOTICON_RE = /(?<![\p{L}\p{N}])(?::-?\)|:-?\(|:-?D|;-?\)|:-?P|<3|\^_\^|xD)(?![\p{L}\p{N}])/gu;

export function findEmoji(s: string): string[] {
  return [...(s.match(EMOJI_RE) ?? []), ...(s.match(EMOTICON_RE) ?? [])];
}

/** Removes emoji and emoticons, then tidies the whitespace they leave behind. */
export function stripEmoji(s: string): string {
  return tidy(s.replace(EMOJI_RE, "").replace(EMOTICON_RE, "").replace(/[\uFE0F\u200D\u20E3]/g, ""));
}

/** Collapses doubled spaces, spaces before punctuation, and dangling separators. */
export function tidy(s: string): string {
  return s
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ +([,.;:!?])/g, "$1")
        .replace(/([(\[]) +/g, "$1")
        .replace(/ +([)\]])/g, "$1")
        .replace(/\(\s*\)|\[\s*\]/g, "")
        .replace(/^[\s\-–—:|·•,]+(?=\S)/, (m) => (/^\s*[•\-–—]\s/.test(m) ? m : ""))
        .replace(/[\s\-–—|·,]+$/, "")
        .trimEnd(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Trims to a limit at the last word (or keyword) boundary, never mid-word. */
export function trimToLimit(s: string, limit: number, unit: "chars" | "bytes" = "chars", sep = " "): string {
  if (measure(s, unit) <= limit) return s;
  const parts = s.split(sep);
  let out = "";
  for (const p of parts) {
    const next = out ? `${out}${sep}${p}` : p;
    if (measure(next, unit) > limit) break;
    out = next;
  }
  if (!out) {
    // A single word longer than the limit: cut by characters.
    const chars = [...s];
    while (chars.length && measure(chars.join(""), unit) > limit) chars.pop();
    out = chars.join("");
  }
  // Never end on a separator or a dangling joiner like "&", "and", "or", "/".
  return out.replace(/(?:[\s,;:\-–—|·&+/]|\b(?:and|or|with|for)\b)+$/iu, "").replace(/[\s,;:\-–—|·&+/]+$/, "");
}

/** Converts HTML to plain text with line breaks and bullets (Apple descriptions are plain text). */
export function stripHtml(s: string): string {
  const entities: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
  return tidy(
    s
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "\n• ")
      .replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol)\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => entities[m] ?? m),
  );
}
export const HTML_RE = /<\/?(?:b|i|u|strong|em|br|p|div|span|ul|ol|li|a|h[1-6]|font)\b[^>]*>|&(?:nbsp|amp|lt|gt|quot|#39);/i;

/** Splits into sentences, keeping line breaks and bullets intact. */
function sentences(s: string): string[] {
  // Split after sentence punctuation on spaces only; line breaks stay attached so paragraphs survive.
  return s.split(/(?<=[.!?])[ \t]+(?=\S)|(?<=\n)|(?<=<br\s*\/?>)/iu);
}

/** Removes every sentence (or bullet line) that matches. */
export function removeSentences(s: string, re: RegExp): string {
  const test = new RegExp(re.source, re.flags.replace("g", ""));
  let out = "";
  for (const part of sentences(s)) {
    if (test.test(part)) {
      // Keep the line break that ended a removed bullet/line.
      if (part.endsWith("\n") && out && !out.endsWith("\n")) out += "\n";
      continue;
    }
    out += out && !out.endsWith("\n") ? ` ${part}` : part;
  }
  return tidy(out);
}

/** Removes matching words/phrases, plus a joining "and"/"&"/"or" left dangling next to them. */
export function removeTerms(s: string, re: RegExp): string {
  const j = "(?:and|&|or|\\+|/)";
  const out = s
    .replace(new RegExp(`\\s*${j}\\s*(?:${re.source})`, re.flags), "")
    .replace(new RegExp(`(?:${re.source})\\s*${j}\\s*`, re.flags), "")
    .replace(re, "");
  // A removed term can leave a dangling separator such as "Budgets:" or "– Budgets".
  return tidy(out.split("\n").map((l) => l.replace(/[\s:\-–—|·,]+$/, "").replace(/^[\s:\-–—|·,]+/, "")).join("\n"));
}

/** Keywords: split on commas, trim, drop short/duplicate/forbidden ones, join with commas (no spaces). */
export function normalizeKeywords(s: string, opts: { drop?: RegExp; limit?: number } = {}): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of s.split(/[,，、;]/)) {
    const k = raw.trim().replace(/\s+/g, " ");
    const key = k.toLocaleLowerCase();
    if (!k || charCount(k) < 3 || seen.has(key)) continue;
    if (opts.drop && new RegExp(opts.drop.source, opts.drop.flags.replace("g", "")).test(k)) continue;
    seen.add(key);
    out.push(k);
  }
  return trimToLimit(out.join(","), opts.limit ?? 100, "bytes", ",");
}

// ───────────────────────── Term lists ─────────────────────────

/** Other mobile platforms and app marketplaces (Apple 2.3.10). */
export const OTHER_PLATFORMS = [
  "android", "google play store", "google play", "play store", "playstore", "apk", "galaxy store", "samsung galaxy store",
  "huawei appgallery", "appgallery", "amazon appstore", "windows phone", "blackberry", "harmonyos", "f-droid",
];
/** Apple platform words, as seen from a Google Play listing. */
export const APPLE_PLATFORMS = ["ios", "iphone", "ipad", "app store", "apple watch", "testflight"];

const PRICE_RE = new RegExp(
  `(?<![\\p{L}\\p{N}-])(?:free|discount(?:ed)?|sale|cheap(?:est)?|half[ -]price|on sale|bogo|cash ?back|coupons?)(?![\\p{L}-])|\\d+\\s?% ?off\\b|[$€£¥฿]\\s?\\d|\\d\\s?(?:usd|thb|baht)\\b`,
  "giu",
);
const RANKING_RE = /#\s?1\b|\bno\.?\s?1\b|\bnumber one\b|\btop[- ]rated\b|\bbest\b|\btop \d+\b|\bapp of the (?:year|day)\b|\bbest of play\b|\bmost (?:popular|downloaded)\b|\b\d+(?:\.\d+)?\s?(?:m|k|million|billion)\+? (?:downloads|users)\b|\bworld'?s (?:best|first|leading)\b/giu;
const PLAY_PROGRAM_RE = /\beditor'?s'? choice\b|\bteacher approved\b|\bplay pass\b|(?<![\p{L}])new(?![\p{L}])/giu;
const CTA_RE = /\b(?:download|install|play|get|try|update) (?:it )?now\b/giu;
const PLACEHOLDER_RE = /lorem ipsum|\bTODO\b|\bTBD\b|\bFIXME\b|\bXXX+\b|\[[^\]\n]{0,40}(?:name|here|insert|app)[^\]\n]{0,40}\]|\{\{[^}]+\}\}|<insert[^>]*>/giu;
const BETA_RE = /\bbeta\b|\btest (?:version|build)\b|\btrial version\b|\bdemo version\b|\bpre-?release\b/giu;
const APPLE_ENDORSE_RE = /\bapple[- ](?:approved|endorsed|certified|recommended)\b|\b(?:endorsed|approved|recommended|certified) by apple\b|\bfeatured by apple\b/giu;
const KIDS_RE = /\bfor (?:kids|children)\b/giu;
const REPEATED_SPECIAL_RE = /([!?.*~★☆♥❤•=_\-+#$@^|])\1{2,}|[!?]{2,}/gu;
/** Well-known app/company names that don't belong in keywords (Apple: "Names of other apps or companies aren't allowed"). */
export const BRAND_NAMES = [
  "instagram", "tiktok", "whatsapp", "facebook", "messenger", "snapchat", "telegram", "wechat", "youtube", "netflix",
  "spotify", "uber", "lazada", "shopee", "amazon", "google", "microsoft", "chatgpt", "openai", "twitter", "pinterest",
  "canva", "duolingo", "candy crush", "minecraft", "roblox", "pubg", "fortnite", "pokemon",
];
const STOPWORDS = new Set(
  "the and for with you your our are this that from into have has can will all any not but its it's get more most also just than then them they their there here what when where which while about over under each every only very much many app apps use using".split(" "),
);

const matches = (s: string, re: RegExp) => [...new Set((s.match(re) ?? []).map((m) => m.trim()))];

// ───────────────────────── Checks ─────────────────────────

export interface LintContext {
  /** Your app name (from the Apple name field if empty) */
  appName?: string;
  company?: string;
}

export function lintListing(l: Listing, ctx: LintContext = {}): Issue[] {
  const issues: Issue[] = [];
  const push = (i: Omit<Issue, "id">) => issues.push({ ...i, id: `${i.field}:${i.rule}:${i.message}` });

  // Limits (every field)
  for (const f of FIELDS) {
    const v = l[f.id];
    const n = measure(v, f.unit);
    if (n > f.limit) {
      push({
        field: f.id,
        level: "error",
        rule: f.store === "apple" ? "App Store Connect" : "Play Console",
        message: `${n} ${f.unit === "bytes" ? "bytes" : "characters"}; the limit is ${f.limit}.`,
        fixLabel: `Trim to ${f.limit}`,
        fix: (t) => (f.id === "apple.keywords" ? normalizeKeywords(t, { limit: f.limit }) : trimToLimit(t, f.limit, f.unit)),
      });
    }
  }
  if (l["apple.name"] && charCount(l["apple.name"].trim()) < 2) {
    push({ field: "apple.name", level: "error", rule: "App Store Connect", message: "The app name must be at least 2 characters." });
  }

  // ─── Apple ───
  const appleFields: FieldId[] = ["apple.name", "apple.subtitle", "apple.promo", "apple.description", "apple.keywords", "apple.whatsNew"];
  const platformRe = wordRe(OTHER_PLATFORMS);
  for (const id of appleFields) {
    const v = l[id];
    if (!v) continue;
    const multiline = FIELD_BY_ID[id].multiline;

    const plat = matches(v, platformRe);
    if (plat.length) {
      push({
        field: id,
        level: "error",
        rule: "Apple 2.3.10",
        message: "Don't mention other mobile platforms or app marketplaces.",
        match: plat.join(", "),
        fixLabel: id === "apple.keywords" ? "Remove those keywords" : multiline ? "Remove those sentences" : "Remove those words",
        fix: (t) =>
          id === "apple.keywords" ? normalizeKeywords(t, { drop: platformRe }) : multiline ? removeSentences(t, platformRe) : removeTerms(t, platformRe),
      });
    }

    const ph = matches(v, PLACEHOLDER_RE);
    if (ph.length) {
      push({ field: id, level: "error", rule: "Apple 2.1", message: "Placeholder text must be removed before submission.", match: ph.join(", ") });
    }

    const beta = matches(v, BETA_RE);
    if (beta.length) {
      push({
        field: id,
        level: "warning",
        rule: "Apple 2.2",
        message: "Betas, demos and trial versions don't belong on the App Store (use TestFlight).",
        match: beta.join(", "),
      });
    }

    const endorse = matches(v, APPLE_ENDORSE_RE);
    if (endorse.length) {
      push({
        field: id,
        level: "error",
        rule: "Apple 5.2.4",
        message: "Don't suggest that Apple endorses or supplies the app.",
        match: endorse.join(", "),
        fixLabel: multiline ? "Remove those sentences" : "Remove those words",
        fix: (t) => (multiline ? removeSentences(t, APPLE_ENDORSE_RE) : removeTerms(t, APPLE_ENDORSE_RE)),
      });
    }

    const kids = matches(v, KIDS_RE);
    if (kids.length) {
      push({
        field: id,
        level: "warning",
        rule: "Apple 2.3.8",
        message: "“For Kids” and “For Children” are reserved for apps in the Kids Category.",
        match: kids.join(", "),
      });
    }

    const emoji = findEmoji(v);
    if (emoji.length) {
      push({
        field: id,
        level: "info",
        rule: "Apple 4.5.6",
        message: "Emoji are allowed in App Store metadata. Remove them if you prefer a cleaner look.",
        match: [...new Set(emoji)].join(" "),
        fixLabel: "Remove emoji",
        fix: id === "apple.keywords" ? (t) => normalizeKeywords(stripEmoji(t)) : stripEmoji,
      });
    }
  }

  // Name, subtitle, keywords: prices and unverifiable claims (2.3.7)
  for (const id of ["apple.name", "apple.subtitle", "apple.keywords"] as const) {
    const v = l[id];
    if (!v) continue;
    const price = matches(v, PRICE_RE);
    if (price.length) {
      push({
        field: id,
        level: "error",
        rule: "Apple 2.3.7",
        message: "Don't include pricing information in the name, subtitle or keywords.",
        match: price.join(", "),
        fixLabel: id === "apple.keywords" ? "Remove those keywords" : "Remove those words",
        fix: (t) => (id === "apple.keywords" ? normalizeKeywords(t, { drop: PRICE_RE }) : removeTerms(t, PRICE_RE)),
      });
    }
    if (id !== "apple.keywords") {
      const claims = matches(v, RANKING_RE);
      if (claims.length) {
        push({
          field: id,
          level: id === "apple.subtitle" ? "error" : "warning",
          rule: "Apple 2.3.7",
          message: "Avoid unverifiable claims like “#1” or “best”.",
          match: claims.join(", "),
          fixLabel: "Remove those words",
          fix: (t) => removeTerms(t, RANKING_RE),
        });
      }
    }
  }
  if (l["apple.subtitle"]) {
    const brands = matches(l["apple.subtitle"], wordRe(BRAND_NAMES));
    if (brands.length) {
      push({ field: "apple.subtitle", level: "error", rule: "Apple 2.3.7", message: "Subtitles shouldn't reference other apps.", match: brands.join(", ") });
    }
  }

  // Description: HTML isn't supported
  for (const id of ["apple.description", "apple.promo", "apple.whatsNew"] as const) {
    if (HTML_RE.test(l[id])) {
      push({
        field: id,
        level: "error",
        rule: "App Store Connect",
        message: "HTML isn't supported. Use plain text with line breaks.",
        match: (l[id].match(HTML_RE) ?? [])[0],
        fixLabel: "Convert to plain text",
        fix: stripHtml,
      });
    }
  }

  // Keywords
  const kw = l["apple.keywords"];
  if (kw) {
    const list = kw.split(/[,，、;]/).map((k) => k.trim()).filter(Boolean);
    const short = list.filter((k) => charCount(k) < 3);
    if (short.length) {
      push({ field: "apple.keywords", level: "error", rule: "App Store Connect", message: "Each keyword must be at least 3 characters.", match: short.join(", "), fixLabel: "Remove short keywords", fix: (t) => normalizeKeywords(t) });
    }
    const lower = list.map((k) => k.toLocaleLowerCase());
    const dupes = lower.filter((k, i) => lower.indexOf(k) !== i);
    if (dupes.length) {
      push({ field: "apple.keywords", level: "warning", rule: "App Store Connect", message: "Duplicate keywords waste the 100-byte budget.", match: [...new Set(dupes)].join(", "), fixLabel: "Remove duplicates", fix: (t) => normalizeKeywords(t) });
    }
    if (/,\s+\S/.test(kw) || /\s,/.test(kw)) {
      push({ field: "apple.keywords", level: "info", rule: "App Store Connect", message: "Spaces after commas use bytes for nothing.", fixLabel: "Remove spaces", fix: (t) => normalizeKeywords(t) });
    }
    // App and company names are already searchable, and so is each word in them.
    const ownStrings = [ctx.appName || l["apple.name"], ctx.company].filter((x): x is string => !!x && x.trim().length >= 3).map((x) => x.trim());
    const ownWords = ownStrings
      .flatMap((x) => x.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
      .filter((w) => !STOPWORDS.has(w) && !APPLE_PLATFORMS.includes(w));
    const own = [...new Set([...ownStrings, ...ownWords])];
    if (own.length) {
      const ownRe = wordRe(own);
      const listLower = kw.split(/[,，、;]/).map((k) => k.trim());
      const hits = listLower.filter((k) => k && new RegExp(`^(?:${ownRe.source})$`, "iu").test(k));
      if (hits.length) {
        push({
          field: "apple.keywords",
          level: "warning",
          rule: "App Store Connect",
          message: "Words from your app and company names are already searchable. Don't repeat them in keywords.",
          match: hits.join(", "),
          fixLabel: "Remove them",
          fix: (t) => normalizeKeywords(t, { drop: new RegExp(`^(?:${ownRe.source})$`, "iu") }),
        });
      }
    }
    const brandRe = wordRe(BRAND_NAMES);
    const brands = matches(kw, brandRe);
    if (brands.length) {
      push({
        field: "apple.keywords",
        level: "error",
        rule: "Apple 2.3.7",
        message: "Names of other apps or companies aren't allowed in keywords.",
        match: brands.join(", "),
        fixLabel: "Remove those keywords",
        fix: (t) => normalizeKeywords(t, { drop: brandRe }),
      });
    }
  }

  // ─── Google Play ───
  const title = l["play.title"];
  if (title) {
    const emoji = findEmoji(title);
    if (emoji.length) {
      push({ field: "play.title", level: "error", rule: "Play metadata", message: "No emojis or emoticons in the app name.", match: [...new Set(emoji)].join(" "), fixLabel: "Remove emoji", fix: stripEmoji });
    }
    const rep = matches(title, REPEATED_SPECIAL_RE);
    if (rep.length) {
      push({
        field: "play.title",
        level: "error",
        rule: "Play metadata",
        message: "No repeated special characters in the app name.",
        match: rep.join(" "),
        fixLabel: "Remove them",
        fix: (t) => tidy(t.replace(REPEATED_SPECIAL_RE, "")),
      });
    }
    const rank = matches(title, RANKING_RE);
    if (rank.length) {
      push({ field: "play.title", level: "error", rule: "Play metadata", message: "No store performance or ranking claims in the app name.", match: rank.join(", "), fixLabel: "Remove those words", fix: (t) => removeTerms(t, RANKING_RE) });
    }
    const price = matches(title, PRICE_RE);
    if (price.length) {
      push({ field: "play.title", level: "error", rule: "Play metadata", message: "No price or promotional information in the app name.", match: price.join(", "), fixLabel: "Remove those words", fix: (t) => removeTerms(t, PRICE_RE) });
    }
    const prog = matches(title, PLAY_PROGRAM_RE);
    if (prog.length) {
      push({
        field: "play.title",
        level: "warning",
        rule: "Play metadata",
        message: "Terms that suggest Google Play programs (“Editor's choice”, “New”) aren't allowed in the app name.",
        match: prog.join(", "),
        fixLabel: "Remove those words",
        fix: (t) => removeTerms(t, PLAY_PROGRAM_RE),
      });
    }
    const cta = matches(title, CTA_RE);
    if (cta.length) {
      push({ field: "play.title", level: "warning", rule: "Play metadata", message: "Calls to action don't describe the app.", match: cta.join(", "), fixLabel: "Remove them", fix: (t) => removeTerms(t, CTA_RE) });
    }
    const letters = title.replace(/[^\p{Lu}\p{Ll}]/gu, "");
    if (letters.length >= 4 && letters === letters.toUpperCase() && /\p{Lu}/u.test(letters)) {
      push({
        field: "play.title",
        level: "warning",
        rule: "Play metadata",
        message: "Avoid ALL CAPS unless it's part of your brand name.",
        match: title,
        fixLabel: "Use title case",
        fix: (t) => t.toLowerCase().replace(/(^|[\s\-–—:(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()),
      });
    }
  }

  for (const id of ["play.short", "play.full"] as const) {
    const v = l[id];
    if (!v) continue;
    const rep = matches(v, REPEATED_SPECIAL_RE);
    if (rep.length) {
      push({ field: id, level: "warning", rule: "Play metadata", message: "Repeated special characters read as improper formatting.", match: rep.join(" "), fixLabel: "Collapse them", fix: (t) => tidy(t.replace(/([!?.])\1{2,}/g, "$1").replace(/[!?]{2,}/g, (m) => m[0]).replace(/([*~★☆♥❤•=_\-+#$@^|])\1{2,}/gu, "")) });
    }
    const deceptive = matches(v, /\bbest (?:[\p{L}\p{N}'-]+ ){0,3}ever\b|\b#\s?1\b|\bnumber one\b|\bworld'?s best\b/giu);
    if (deceptive.length) {
      push({ field: id, level: "warning", rule: "Play metadata", message: "Avoid deceptive claims like “best game ever”.", match: deceptive.join(", ") });
    }
    const apple = matches(v, wordRe(APPLE_PLATFORMS));
    if (apple.length) {
      push({ field: id, level: "info", rule: "Play metadata", message: "Mentions of Apple platforms are irrelevant to Android users.", match: apple.join(", ") });
    }
  }

  // Full description: repetitive keywords and testimonials
  const full = l["play.full"];
  if (full) {
    const words = (full.toLocaleLowerCase().match(/[\p{L}\p{N}']{4,}/gu) ?? []).filter((w) => !STOPWORDS.has(w));
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    const total = Math.max(words.length, 1);
    const stuffed = [...counts].filter(([, c]) => c >= 6 && c / total > 0.04).sort((a, b) => b[1] - a[1]);
    if (stuffed.length) {
      push({
        field: "play.full",
        level: "warning",
        rule: "Play metadata",
        message: "Repetitive keywords can get a listing suspended. Use these words less often.",
        match: stuffed.slice(0, 5).map(([w, c]) => `${w} ×${c}`).join(", "),
      });
    }
    const testimonial = full
      .split("\n")
      .filter((line) => /[“"«].{8,}[”"»]/u.test(line) || /★{3,}/u.test(line))
      .filter((line) => !/[—–-]\s*\p{L}|(?:review|rated|says|said|by)\s+\p{Lu}/u.test(line.split(/[”"»]/u).slice(-1)[0] ?? ""));
    if (testimonial.length) {
      push({
        field: "play.full",
        level: "warning",
        rule: "Play metadata",
        message: "Unattributed or anonymous testimonials aren't allowed. Add who said it, or remove them.",
        match: testimonial[0].trim().slice(0, 60),
      });
    }
  }

  // Order: errors first, then by field order
  const order = { error: 0, warning: 1, info: 2 };
  const fieldIndex = (f: FieldId) => FIELDS.findIndex((x) => x.id === f);
  return issues.sort((a, b) => fieldIndex(a.field) - fieldIndex(b.field) || order[a.level] - order[b.level]);
}

/** Applies every available fix for errors and warnings (never info), field by field, until stable. */
export function fixAll(l: Listing, ctx: LintContext = {}, levels: Level[] = ["error", "warning"]): { listing: Listing; applied: number } {
  let cur = { ...l };
  let applied = 0;
  for (let pass = 0; pass < 60; pass++) {
    // Structure first (HTML → plain text), then content removals, then length trims last,
    // so a trim never cuts text that a later fix would have removed anyway.
    const rank = (i: Issue) => (i.fixLabel === "Convert to plain text" ? 0 : i.fixLabel?.startsWith("Trim to") ? 2 : 1);
    const fixable = lintListing(cur, ctx)
      .filter((i) => i.fix && levels.includes(i.level))
      .sort((a, b) => rank(a) - rank(b));
    if (!fixable.length) break;
    // Apply one fix, then re-check: later fixes must see the updated text.
    const i = fixable[0];
    const next = i.fix!(cur[i.field]);
    if (next === cur[i.field]) {
      // This fix can't change anything; try the rest once before giving up.
      const other = fixable.slice(1).find((x) => x.fix!(cur[x.field]) !== cur[x.field]);
      if (!other) break;
      cur = { ...cur, [other.field]: other.fix!(cur[other.field]) };
    } else {
      cur = { ...cur, [i.field]: next };
    }
    applied++;
  }
  return { listing: cur, applied };
}
