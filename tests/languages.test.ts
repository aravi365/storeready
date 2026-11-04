import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  detectLanguage,
  detectLanguageFromPath,
  languageById,
  normalizeLanguage,
  storeLocale,
} from "@/utils/languages";

describe("language table", () => {
  it("covers every App Store Connect localization (50)", () => {
    expect(LANGUAGES).toHaveLength(50);
    expect(new Set(LANGUAGES.map((l) => l.id)).size).toBe(50);
    for (const id of ["en-US", "ja", "zh-Hans", "zh-Hant", "de-DE", "es-MX", "pt-BR", "th", "ar-SA", "hi", "ko", "vi", "bn-BD", "sl-SI", "ur"]) {
      expect(LANGUAGES.some((l) => l.id === id)).toBe(true);
    }
  });

  it("maps to Google Play codes where they differ", () => {
    expect(storeLocale("play_store", "ja")).toBe("ja-JP");
    expect(storeLocale("play_store", "zh-Hans")).toBe("zh-CN");
    expect(storeLocale("play_store", "he")).toBe("iw-IL");
    expect(storeLocale("play_store", "es-MX")).toBe("es-419");
    expect(storeLocale("app_store", "ja")).toBe("ja");
    expect(storeLocale("app_store", "en-US")).toBe("en-US");
  });

  it("normalizes short, Play and underscore codes", () => {
    expect(normalizeLanguage("en")).toBe("en-US");
    expect(normalizeLanguage("ja_JP")).toBe("ja");
    expect(normalizeLanguage("zh-CN")).toBe("zh-Hans");
    expect(normalizeLanguage("zh-TW")).toBe("zh-Hant");
    expect(normalizeLanguage("iw-IL")).toBe("he");
    expect(normalizeLanguage("DE-de")).toBe("de-DE");
    expect(normalizeLanguage("xx")).toBeUndefined();
  });

  it("falls back gracefully for unknown ids", () => {
    expect(languageById("xx").name).toBe("xx");
  });
});

describe("detectLanguage (pasted text)", () => {
  it.each([
    ["Plan your monthly budget and track every expense with simple charts.", "en-US"],
    ["Planifica tu presupuesto mensual y controla todos tus gastos con gráficos sencillos.", "es-ES"],
    ["Planeje seu orçamento mensal e acompanhe todas as suas despesas com gráficos simples.", "pt-BR"],
    ["Planifiez votre budget mensuel et suivez toutes vos dépenses avec des graphiques simples.", "fr-FR"],
    ["Planen Sie Ihr monatliches Budget und behalten Sie alle Ausgaben mit einfachen Diagrammen im Blick.", "de-DE"],
    ["Pianifica il tuo budget mensile e tieni traccia di tutte le spese con grafici semplici.", "it"],
    ["Plan je maandelijkse budget en houd al je uitgaven bij met eenvoudige grafieken.", "nl-NL"],
    ["Planera din månadsbudget och håll koll på alla utgifter med enkla diagram.", "sv"],
    ["Zaplanuj swój miesięczny budżet i śledź wszystkie wydatki za pomocą prostych wykresów.", "pl"],
    ["Aylık bütçeni planla ve tüm harcamalarını basit grafiklerle takip et.", "tr"],
    ["Lập kế hoạch ngân sách hàng tháng và theo dõi mọi khoản chi tiêu của bạn.", "vi"],
    ["Rencanakan anggaran bulanan anda dan lacak semua pengeluaran dengan grafik yang sederhana.", "id"],
    ["วางแผนงบประมาณรายเดือนและติดตามค่าใช้จ่ายทุกรายการ", "th"],
    ["毎月の予算を立てて、すべての支出をシンプルなグラフで管理しましょう。", "ja"],
    ["规划你的每月预算，用简单的图表跟踪所有支出。这是我们的应用。", "zh-Hans"],
    ["規劃你的每月預算，用簡單的圖表追蹤所有支出。這是我們的應用。", "zh-Hant"],
    ["매달 예산을 계획하고 간단한 차트로 모든 지출을 추적하세요.", "ko"],
    ["خطط لميزانيتك الشهرية وتتبع جميع نفقاتك برسوم بيانية بسيطة.", "ar-SA"],
    ["תכננו את התקציב החודשי ועקבו אחרי כל ההוצאות.", "he"],
    ["Планируйте ежемесячный бюджет и отслеживайте все расходы.", "ru"],
    ["Плануйте щомісячний бюджет і відстежуйте всі витрати.", "uk"],
    ["Σχεδιάστε τον μηνιαίο προϋπολογισμό σας.", "el"],
    ["अपने मासिक बजट की योजना बनाएं और सभी खर्चों को ट्रैक करें।", "hi"],
    ["আপনার মাসিক বাজেট পরিকল্পনা করুন এবং সব খরচ ট্র্যাক করুন।", "bn-BD"],
    ["உங்கள் மாதாந்திர பட்ஜெட்டைத் திட்டமிடுங்கள்.", "ta"],
  ])("%s → %s", (text, id) => {
    expect(detectLanguage(text)?.id).toBe(id);
  });

  it("is confident on clear text, and gives up on too little", () => {
    expect(detectLanguage("毎月の予算を立てましょう")?.confidence).toBe("high");
    expect(detectLanguage("OK")).toBeNull();
    expect(detectLanguage("12345 !!!")).toBeNull();
  });

  it("Japanese with kanji is not mistaken for Chinese", () => {
    expect(detectLanguage("予算管理アプリ")?.id).toBe("ja");
  });

  it("falls back to the default for gibberish Latin text", () => {
    expect(detectLanguage("xqzv brrk tktk plmm")?.id).toBe(DEFAULT_LANGUAGE);
  });
});

describe("detectLanguageFromPath (screenshots)", () => {
  it.each([
    ["shots/ja/01.png", "ja"],
    ["shots/de-DE/01.png", "de-DE"],
    ["shots/en_US/01.png", "en-US"],
    ["fastlane/screenshots/zh-Hans/01.png", "zh-Hans"],
    ["Japanese/home.png", "ja"],
    ["deutsch/home.png", "de-DE"],
    ["home_fr.png", "fr-FR"],
    ["home-de.png", "de-DE"],
    ["home_es.png", "es-ES"],
    ["home_th.png", "th"],
    ["screen.ko.png", "ko"],
    ["home_pt-BR.png", "pt-BR"],
    ["หน้าแรก.png", "th"],
    ["ホーム画面.png", "ja"],
    ["it/home.png", "it"], // whole folder: trusted
    ["no/home.png", "no"],
  ])("%s → %s", (path, id) => expect(detectLanguageFromPath(path)).toBe(id));

  it.each(["home_it_works.png", "no_ads.png", "hi_there.png", "id_card.png", "my_folder/home.png", "screenshot_01.png", "us/home.png", "uk/home.png"])(
    "%s → nothing (ambiguous or no language)",
    (path) => expect(detectLanguageFromPath(path)).toBeUndefined(),
  );
});
