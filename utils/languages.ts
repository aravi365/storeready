/**
 * Every App Store Connect localization, with the matching Google Play Console locale code,
 * plus language detection from text (for pasted listing copy) and from file/folder names
 * (for screenshots).
 *
 * Apple names/codes: https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations
 * (checked 2026-11-05; codes are App Store Connect's locale shortcodes). Play codes follow the
 * Play Console / fastlane supply language list.
 */

export interface Language {
  /** Canonical id = App Store Connect code */
  id: string;
  apple: string;
  play: string;
  name: string;
  native: string;
  /** Extra file/folder-name hints */
  hints?: string[];
}

export const LANGUAGES: Language[] = [
  { id: "en-US", apple: "en-US", play: "en-US", name: "English (U.S.)", native: "English", hints: ["english", "eng", "en"] },
  { id: "en-GB", apple: "en-GB", play: "en-GB", name: "English (U.K.)", native: "English (UK)", hints: ["uk-english", "british"] },
  { id: "en-AU", apple: "en-AU", play: "en-AU", name: "English (Australia)", native: "English (AU)" },
  { id: "en-CA", apple: "en-CA", play: "en-CA", name: "English (Canada)", native: "English (CA)" },
  { id: "ar-SA", apple: "ar-SA", play: "ar", name: "Arabic", native: "العربية", hints: ["arabic", "ar"] },
  { id: "bn-BD", apple: "bn-BD", play: "bn-BD", name: "Bangla", native: "বাংলা", hints: ["bangla", "bengali", "bn"] },
  { id: "ca", apple: "ca", play: "ca", name: "Catalan", native: "Català", hints: ["catalan", "catala"] },
  { id: "zh-Hans", apple: "zh-Hans", play: "zh-CN", name: "Chinese (Simplified)", native: "简体中文", hints: ["chinese", "simplified", "zh-cn", "zhs", "chs", "zh"] },
  { id: "zh-Hant", apple: "zh-Hant", play: "zh-TW", name: "Chinese (Traditional)", native: "繁體中文", hints: ["traditional", "zh-tw", "zh-hk", "zht", "cht"] },
  { id: "hr", apple: "hr", play: "hr", name: "Croatian", native: "Hrvatski", hints: ["croatian", "hrvatski"] },
  { id: "cs", apple: "cs", play: "cs-CZ", name: "Czech", native: "Čeština", hints: ["czech", "cestina"] },
  { id: "da", apple: "da", play: "da-DK", name: "Danish", native: "Dansk", hints: ["danish", "dansk"] },
  { id: "nl-NL", apple: "nl-NL", play: "nl-NL", name: "Dutch", native: "Nederlands", hints: ["dutch", "nederlands", "nl"] },
  { id: "fi", apple: "fi", play: "fi-FI", name: "Finnish", native: "Suomi", hints: ["finnish", "suomi"] },
  { id: "fr-FR", apple: "fr-FR", play: "fr-FR", name: "French", native: "Français", hints: ["french", "francais", "fr"] },
  { id: "fr-CA", apple: "fr-CA", play: "fr-CA", name: "French (Canada)", native: "Français (CA)" },
  { id: "de-DE", apple: "de-DE", play: "de-DE", name: "German", native: "Deutsch", hints: ["german", "deutsch", "de"] },
  { id: "el", apple: "el", play: "el-GR", name: "Greek", native: "Ελληνικά", hints: ["greek"] },
  { id: "gu-IN", apple: "gu-IN", play: "gu", name: "Gujarati", native: "ગુજરાતી", hints: ["gujarati", "gu"] },
  { id: "he", apple: "he", play: "iw-IL", name: "Hebrew", native: "עברית", hints: ["hebrew", "iw"] },
  { id: "hi", apple: "hi", play: "hi-IN", name: "Hindi", native: "हिन्दी", hints: ["hindi"] },
  { id: "hu", apple: "hu", play: "hu-HU", name: "Hungarian", native: "Magyar", hints: ["hungarian", "magyar"] },
  { id: "id", apple: "id", play: "id", name: "Indonesian", native: "Bahasa Indonesia", hints: ["indonesian", "bahasa"] },
  { id: "it", apple: "it", play: "it-IT", name: "Italian", native: "Italiano", hints: ["italian", "italiano"] },
  { id: "ja", apple: "ja", play: "ja-JP", name: "Japanese", native: "日本語", hints: ["japanese", "ja", "jp", "jpn"] },
  { id: "kn", apple: "kn", play: "kn-IN", name: "Kannada", native: "ಕನ್ನಡ", hints: ["kannada", "kn"] },
  { id: "ko", apple: "ko", play: "ko-KR", name: "Korean", native: "한국어", hints: ["korean", "ko", "kr", "kor"] },
  { id: "ms", apple: "ms", play: "ms", name: "Malay", native: "Bahasa Melayu", hints: ["malay", "melayu"] },
  { id: "ml", apple: "ml", play: "ml-IN", name: "Malayalam", native: "മലയാളം", hints: ["malayalam", "ml"] },
  { id: "mr", apple: "mr", play: "mr-IN", name: "Marathi", native: "मराठी", hints: ["marathi", "mr"] },
  { id: "no", apple: "no", play: "no-NO", name: "Norwegian", native: "Norsk", hints: ["norwegian", "norsk", "nb"] },
  { id: "or", apple: "or", play: "or", name: "Odia", native: "ଓଡ଼ିଆ", hints: ["odia", "oriya"] },
  { id: "pl", apple: "pl", play: "pl-PL", name: "Polish", native: "Polski", hints: ["polish", "polski", "pl"] },
  { id: "pt-BR", apple: "pt-BR", play: "pt-BR", name: "Portuguese (Brazil)", native: "Português (BR)", hints: ["portuguese", "brazil", "brasil", "pt"] },
  { id: "pt-PT", apple: "pt-PT", play: "pt-PT", name: "Portuguese (Portugal)", native: "Português (PT)", hints: ["portugal"] },
  { id: "pa", apple: "pa", play: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", hints: ["punjabi"] },
  { id: "ro", apple: "ro", play: "ro", name: "Romanian", native: "Română", hints: ["romanian", "romana"] },
  { id: "ru", apple: "ru", play: "ru-RU", name: "Russian", native: "Русский", hints: ["russian", "ru", "rus"] },
  { id: "sk", apple: "sk", play: "sk", name: "Slovak", native: "Slovenčina", hints: ["slovak", "slovencina"] },
  { id: "sl-SI", apple: "sl-SI", play: "sl", name: "Slovenian", native: "Slovenščina", hints: ["slovenian", "slovenscina", "sl"] },
  { id: "es-MX", apple: "es-MX", play: "es-419", name: "Spanish (Mexico)", native: "Español (MX)", hints: ["mexico", "latam", "es-419"] },
  { id: "es-ES", apple: "es-ES", play: "es-ES", name: "Spanish (Spain)", native: "Español", hints: ["spanish", "espanol", "es"] },
  { id: "sv", apple: "sv", play: "sv-SE", name: "Swedish", native: "Svenska", hints: ["swedish", "svenska"] },
  { id: "ta", apple: "ta", play: "ta-IN", name: "Tamil", native: "தமிழ்", hints: ["tamil"] },
  { id: "te", apple: "te", play: "te-IN", name: "Telugu", native: "తెలుగు", hints: ["telugu"] },
  { id: "th", apple: "th", play: "th", name: "Thai", native: "ไทย", hints: ["thai", "th", "th-th"] },
  { id: "tr", apple: "tr", play: "tr-TR", name: "Turkish", native: "Türkçe", hints: ["turkish", "turkce", "tr"] },
  { id: "uk", apple: "uk", play: "uk", name: "Ukrainian", native: "Українська", hints: ["ukrainian", "ua"] },
  { id: "ur", apple: "ur", play: "ur", name: "Urdu", native: "اردو", hints: ["urdu"] },
  { id: "vi", apple: "vi", play: "vi", name: "Vietnamese", native: "Tiếng Việt", hints: ["vietnamese", "vi", "vn"] },
];

export const DEFAULT_LANGUAGE = "en-US";

const BY_ID = new Map(LANGUAGES.map((l) => [l.id.toLowerCase(), l]));
/** Short or alternative codes → canonical id */
const ALIASES: Record<string, string> = {
  en: "en-US", "en-us": "en-US", ar: "ar-SA", bn: "bn-BD", zh: "zh-Hans", "zh-cn": "zh-Hans", "zh-sg": "zh-Hans", "zh-tw": "zh-Hant", "zh-hk": "zh-Hant",
  "cs-cz": "cs", "da-dk": "da", nl: "nl-NL", "fi-fi": "fi", fr: "fr-FR", de: "de-DE", "el-gr": "el", gu: "gu-IN", iw: "he", "iw-il": "he", "he-il": "he",
  "hi-in": "hi", "hu-hu": "hu", "it-it": "it", "ja-jp": "ja", "kn-in": "kn", "ko-kr": "ko", "ml-in": "ml", "mr-in": "mr", nb: "no", "nb-no": "no", "no-no": "no",
  pt: "pt-BR", "pl-pl": "pl", "ru-ru": "ru", sl: "sl-SI", es: "es-ES", "es-419": "es-MX", "sv-se": "sv", "ta-in": "ta", "te-in": "te", "th-th": "th",
  "tr-tr": "tr", "uk-ua": "uk", "ur-pk": "ur", "vi-vn": "vi", "ms-my": "ms", "id-id": "id", "ro-ro": "ro", "sk-sk": "sk", "hr-hr": "hr",
};

/** Resolves any App Store, Play or short code ("en", "ja-JP", "zh-CN", "iw-IL") to a canonical id. */
export function normalizeLanguage(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const c = code.trim().replace(/_/g, "-").toLowerCase();
  if (BY_ID.has(c)) return BY_ID.get(c)!.id;
  if (ALIASES[c]) return ALIASES[c];
  const byPlay = LANGUAGES.find((l) => l.play.toLowerCase() === c);
  return byPlay?.id;
}

export function languageById(id: string): Language {
  return BY_ID.get((normalizeLanguage(id) ?? id).toLowerCase()) ?? { id, apple: id, play: id, name: id, native: id };
}

export const languageName = (id: string) => languageById(id).name;
export const storeLocale = (store: "app_store" | "play_store" | "custom", id: string) => (store !== "play_store" ? languageById(id).apple : languageById(id).play);

// ───────────────────────── Detection from text ─────────────────────────

const SCRIPTS: [string, RegExp][] = [
  ["Thai", /\p{Script=Thai}/gu],
  ["Hangul", /\p{Script=Hangul}/gu],
  ["Kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/gu],
  ["Han", /\p{Script=Han}/gu],
  ["Arabic", /\p{Script=Arabic}/gu],
  ["Hebrew", /\p{Script=Hebrew}/gu],
  ["Cyrillic", /\p{Script=Cyrillic}/gu],
  ["Greek", /\p{Script=Greek}/gu],
  ["Devanagari", /\p{Script=Devanagari}/gu],
  ["Bengali", /\p{Script=Bengali}/gu],
  ["Gujarati", /\p{Script=Gujarati}/gu],
  ["Gurmukhi", /\p{Script=Gurmukhi}/gu],
  ["Oriya", /\p{Script=Oriya}/gu],
  ["Tamil", /\p{Script=Tamil}/gu],
  ["Telugu", /\p{Script=Telugu}/gu],
  ["Kannada", /\p{Script=Kannada}/gu],
  ["Malayalam", /\p{Script=Malayalam}/gu],
  ["Latin", /\p{Script=Latin}/gu],
];

/** Frequent words per Latin-script language (plus characters that strongly suggest it). */
const LATIN_PROFILES: { id: string; words: string[]; chars?: RegExp }[] = [
  { id: "en-US", words: "the and you your with for to of is are this that it in on our can be from all".split(" ") },
  { id: "es-ES", words: "el la los las de que y en un una con para tu tus es por del al más como su".split(" "), chars: /[ñ¿¡]/giu },
  { id: "pt-BR", words: "o a os as de que e em um uma com para seu sua você não do da mais por é".split(" "), chars: /[ãõ]|ção/giu },
  { id: "fr-FR", words: "le la les de des et en un une pour vous votre avec est que du sur pas plus dans".split(" "), chars: /[àâçèêëîïôœùû]/giu },
  { id: "de-DE", words: "der die das und ist mit für sie ihre ein eine zu den von auf nicht ihr dein mehr".split(" "), chars: /[ß]|[äöü]/giu },
  { id: "it", words: "il lo la gli le di e che un una per con tuo tua è non più del della sono".split(" "), chars: /[àèéìòù](?=\s|$)/giu },
  { id: "nl-NL", words: "de het een en van je jouw met voor is op dat niet zijn in ook om".split(" "), chars: /ij/giu },
  { id: "sv", words: "och att det som en är för med på din ditt av till inte om har".split(" "), chars: /[åäö]/giu },
  { id: "da", words: "og at det som en er for med på din dit af til ikke om har jeg".split(" "), chars: /[æøå]/giu },
  { id: "no", words: "og at det som en er for med på din ditt av til ikke om har jeg".split(" "), chars: /[æøå]/giu },
  { id: "fi", words: "ja on se että kuin ei voit sinun kanssa tai mutta myös kun".split(" "), chars: /[äö]|aa|ää|ii/giu },
  { id: "pl", words: "i w na z że jest do nie się jak dla twój twoje to od".split(" "), chars: /[ąćęłńśźż]/giu },
  { id: "cs", words: "a v na je se že s pro do jak to vaše váš není od".split(" "), chars: /[ěřůčšž]/giu },
  { id: "sk", words: "a v na je sa že s pre do ako to vaše váš nie od".split(" "), chars: /[ľĺŕäô]/giu },
  { id: "hu", words: "a az és hogy egy van nem is meg ez el a te veled".split(" "), chars: /[őű]/giu },
  { id: "ro", words: "și în de la cu un o pentru este nu că mai tău ta".split(" "), chars: /[șțăâî]/giu },
  { id: "tr", words: "ve bir bu için ile da de ne çok daha sen senin olan".split(" "), chars: /[ğış]/giu },
  { id: "id", words: "dan yang di untuk dengan ini itu anda dari ke tidak lebih bisa".split(" ") },
  { id: "ms", words: "dan yang di untuk dengan ini itu anda dari ke tidak lebih boleh".split(" ") },
  { id: "vi", words: "và của là có cho với không một những bạn này được các".split(" "), chars: /[ăđơư]|[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/giu },
  { id: "hr", words: "i u je na da se za od s to su ne kao vaš vaše".split(" "), chars: /[čćđšž]/giu },
  { id: "ca", words: "el la els les de i que en un una per amb és al del més".split(" "), chars: /l·l|[àèòç]/giu },
];

export interface LanguageGuess {
  id: string;
  confidence: "high" | "medium" | "low";
}

/** Guesses the language of a piece of text. Returns null when there's too little to go on. */
export function detectLanguage(text: string): LanguageGuess | null {
  const counts = Object.fromEntries(SCRIPTS.map(([n, re]) => [n, text.match(re)?.length ?? 0])) as Record<string, number>;
  const nonLatinTotal = SCRIPTS.filter(([n]) => n !== "Latin").reduce((sum, [n]) => sum + counts[n], 0);
  // Letters plus combining marks (Thai, Indic vowel signs are marks, not letters).
  const letters = (text.match(/\p{L}/gu)?.length ?? 0) + (text.match(/\p{M}/gu)?.length ?? 0);
  // A few characters of a distinctive script are enough; Latin text needs a bit more to go on.
  if (nonLatinTotal < 3 && letters < 8) return null;
  const nonLatin = SCRIPTS.filter(([n]) => n !== "Latin").sort((a, b) => counts[b[0]] - counts[a[0]]);
  const [topScript] = nonLatin[0];
  const cjk = counts.Han + counts.Kana;

  // Japanese mixes kana and kanji, so count CJK scripts together.
  const topCount = topScript === "Han" || topScript === "Kana" ? cjk : counts[topScript];
  if (topCount >= Math.max(3, letters * 0.25)) {
    const high = { confidence: "high" as const };
    if (counts.Kana > 0 && counts.Kana >= cjk * 0.05) return { id: "ja", ...high };
    switch (topScript) {
      case "Kana":
        return { id: "ja", ...high };
      case "Han": {
        const simp = text.match(/[这们说时国会来对发为应让体学关简单现开动么还没样经过]/gu)?.length ?? 0;
        const trad = text.match(/[這們說時國會來對發為應讓體學關簡單現開動麼還沒樣經過]/gu)?.length ?? 0;
        return { id: trad > simp ? "zh-Hant" : "zh-Hans", confidence: simp + trad > 0 ? "high" : "medium" };
      }
      case "Thai":
        return { id: "th", ...high };
      case "Hangul":
        return { id: "ko", ...high };
      case "Arabic":
        return /[ٹڈڑںےھ]/u.test(text) ? { id: "ur", ...high } : { id: "ar-SA", ...high };
      case "Hebrew":
        return { id: "he", ...high };
      case "Greek":
        return { id: "el", ...high };
      case "Cyrillic":
        return /[іїєґ]/iu.test(text) ? { id: "uk", ...high } : { id: "ru", ...high };
      case "Devanagari":
        return /आहे|आणि|ळ/u.test(text) ? { id: "mr", confidence: "medium" } : { id: "hi", confidence: "medium" };
      case "Bengali":
        return { id: "bn-BD", ...high };
      case "Gujarati":
        return { id: "gu-IN", ...high };
      case "Gurmukhi":
        return { id: "pa", ...high };
      case "Oriya":
        return { id: "or", ...high };
      case "Tamil":
        return { id: "ta", ...high };
      case "Telugu":
        return { id: "te", ...high };
      case "Kannada":
        return { id: "kn", ...high };
      case "Malayalam":
        return { id: "ml", ...high };
    }
  }

  // Latin script: score common words and tell-tale characters.
  const words = text.toLocaleLowerCase().match(/[\p{L}'·]+/gu) ?? [];
  if (!words.length) return null;
  const scores = LATIN_PROFILES.map((p) => {
    const set = new Set(p.words);
    const w = words.filter((x) => set.has(x)).length / words.length;
    const c = p.chars ? Math.min(1, (text.match(p.chars)?.length ?? 0) / Math.max(words.length, 1)) : 0;
    return { id: p.id, score: w + c * 0.6 };
  }).sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (best.score < 0.04) return { id: DEFAULT_LANGUAGE, confidence: "low" };
  const margin = best.score - (second?.score ?? 0);
  return { id: best.id, confidence: margin > 0.08 && words.length >= 6 ? "high" : margin > 0.03 ? "medium" : "low" };
}

// ───────────────────────── Detection from file and folder names ─────────────────────────

/** Two-letter codes that are also everyday words; only trusted as a whole folder name. */
const AMBIGUOUS = new Set(["it", "no", "or", "he", "hi", "id", "ms", "pa", "ca", "ta", "te", "el", "us", "se", "uk", "ml", "mr", "ua", "sl"]);

/**
 * Finds a language in a path like "shots/ja/01.png", "home_de-DE.png", "Japanese/…" or "หน้าแรก.png".
 * Returns undefined when nothing clear is found.
 */
export function detectLanguageFromPath(path: string): string | undefined {
  const norm = path.replace(/\\/g, "/");
  const segments = norm.split("/").filter(Boolean);
  const file = segments.at(-1) ?? "";
  const folders = segments.slice(0, -1);

  // 1. Whole folder names, deepest first ("en-US", "ja", "zh-Hans", "japanese"),
  //    then words inside folder names ("shots_TH", "screens-ja")
  for (const seg of [...folders].reverse()) {
    const id = matchToken(seg.toLowerCase(), true) ?? matchTokens(seg.toLowerCase());
    if (id) return id;
  }
  // 2. Tokens in the file name ("home_de-DE.png", "01-ja.png", "screen.fr.png")
  const stem = file.replace(/\.[^.]+$/, "").toLowerCase();
  const fromFile = matchTokens(stem);
  if (fromFile) return fromFile;
  // 3. Non-Latin script in the name itself
  const guess = detectLanguage(stem.replace(/[_\-.\d]+/g, " "));
  if (guess && guess.id !== DEFAULT_LANGUAGE && guess.confidence === "high") return guess.id;
  return undefined;
}

/** Words in a name, last first; region pairs like "de-de" are tried before their halves. */
function matchTokens(name: string): string | undefined {
  const tokens = name.split(/[\s_.()[\]]+/).filter(Boolean);
  for (const t of [...tokens].reverse()) {
    const id = matchToken(t, false);
    if (id) return id;
    for (const part of t.split("-").reverse()) {
      const p = matchToken(part, false);
      if (p) return p;
    }
  }
  return undefined;
}

/** Never auto-detected: "us" (about us?) and "uk" (U.K. English or Ukrainian?) are too ambiguous. */
const NEVER = new Set(["us", "uk"]);

function matchToken(t: string, wholeSegment: boolean): string | undefined {
  if (!t || NEVER.has(t)) return undefined;
  const code = normalizeLanguage(t);
  if (code && (t.length > 2 || wholeSegment || !AMBIGUOUS.has(t))) return code;
  for (const l of LANGUAGES) {
    if (l.native.toLowerCase() === t) return l.id;
    if (l.hints?.some((h) => h === t && (h.length > 2 || wholeSegment || !AMBIGUOUS.has(h)))) return l.id;
  }
  return undefined;
}
