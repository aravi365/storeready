import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { EMPTY_LISTING } from "@/utils/listingRules";
import { buildFastlaneZip, fastlaneFiles } from "@/utils/listingExport";

const en = { ...EMPTY_LISTING, "apple.name": "Penny", "apple.keywords": "budget,money", "play.title": "Penny: Budget", "play.full": "Plan budgets." };
const th = { ...EMPTY_LISTING, "apple.name": "เพนนี", "play.short": "วางแผนงบประมาณ" };

describe("fastlane export", () => {
  it("writes each non-empty field to fastlane's paths per locale", () => {
    expect(fastlaneFiles({ en, th }).map((f) => f.path)).toEqual([
      "fastlane/metadata/en-US/name.txt",
      "fastlane/metadata/en-US/keywords.txt",
      "fastlane/metadata/android/en-US/title.txt",
      "fastlane/metadata/android/en-US/full_description.txt",
      "fastlane/metadata/th/name.txt",
      "fastlane/metadata/android/th/short_description.txt",
    ]);
  });

  it("trims and ends each file with a newline, keeping Thai intact", () => {
    const f = fastlaneFiles({ th: { ...th, "apple.name": "  เพนนี  " } });
    expect(f[0].text).toBe("เพนนี\n");
  });

  it("zips the files with a README, and refuses an empty export", async () => {
    const zip = await JSZip.loadAsync(await (await buildFastlaneZip({ en })).arrayBuffer());
    expect(Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort()).toEqual(
      [...fastlaneFiles({ en }).map((f) => f.path), "README.md"].sort(),
    );
    expect(await zip.file("fastlane/metadata/en-US/keywords.txt")!.async("string")).toBe("budget,money\n");
    await expect(buildFastlaneZip({ en: EMPTY_LISTING })).rejects.toThrow(/Nothing to export/);
  });
});
