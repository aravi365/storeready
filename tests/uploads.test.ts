import { describe, expect, it } from "vitest";
import { isAcceptedImage, isHiddenPath, partitionUploads, relPathOf } from "@/utils/uploads";

function file(path: string, { type = "image/png", size = 10 } = {}) {
  const f = new File([new Uint8Array(size)], path.split("/").pop()!, { type });
  Object.defineProperty(f, "webkitRelativePath", { value: path });
  return f;
}

describe("relPathOf", () => {
  it("prefers react-dropzone's relativePath, then webkitRelativePath, then path", () => {
    const a = new File([], "a.png");
    Object.assign(a, { relativePath: "./en/a.png" });
    expect(relPathOf(a)).toBe("en/a.png");
    expect(relPathOf(file("th/ipad/b.png"))).toBe("th/ipad/b.png");
    const c = new File([], "c.png");
    Object.assign(c, { path: "/shots/c.png" });
    expect(relPathOf(c)).toBe("shots/c.png");
    expect(relPathOf(new File([], "plain.png"))).toBe("plain.png");
  });
});

describe("isHiddenPath", () => {
  it.each([
    [".DS_Store", true],
    ["shots/.DS_Store", true],
    ["shots/._home.png", true],
    [".git/config", true],
    ["__MACOSX/shots/home.png", true],
    ["shots/Thumbs.db", true],
    ["shots/desktop.ini", true],
    ["shots/home.png", false],
    ["my.app/home.png", false],
  ])("%s → %s", (p, hidden) => expect(isHiddenPath(p)).toBe(hidden));
});

describe("isAcceptedImage", () => {
  it("accepts PNG and JPEG by type, or by extension when the type is missing", () => {
    expect(isAcceptedImage({ type: "image/png", name: "a.png" })).toBe(true);
    expect(isAcceptedImage({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(isAcceptedImage({ type: "", name: "a.JPEG" })).toBe(true);
    expect(isAcceptedImage({ type: "image/webp", name: "a.webp" })).toBe(false);
    expect(isAcceptedImage({ type: "image/heic", name: "a.heic" })).toBe(false);
    expect(isAcceptedImage({ type: "text/plain", name: "a.png" })).toBe(false);
  });
});

describe("partitionUploads", () => {
  it("filters a mixed folder tree and counts what was skipped", () => {
    const r = partitionUploads(
      [
        file("shots/en/iphone/10_settings.png"),
        file("shots/en/iphone/2_home.png"),
        file("shots/th/ipad/01.jpg", { type: "image/jpeg" }),
        file("shots/.DS_Store", { type: "" }),
        file("shots/en/notes.txt", { type: "text/plain" }),
        file("shots/en/huge.png", { size: 2000 }),
      ],
      1000,
    );
    expect(r.images.map(relPathOf)).toEqual(["shots/en/iphone/2_home.png", "shots/en/iphone/10_settings.png", "shots/th/ipad/01.jpg"]);
    expect(r).toMatchObject({ wrongType: 1, tooBig: 1, hidden: 1, folders: 2 });
  });

  it("counts no folders for loose files", () => {
    expect(partitionUploads([file("a.png"), file("b.png")]).folders).toBe(0);
  });

  it("returns nothing for an empty or image-free batch", () => {
    expect(partitionUploads([]).images).toEqual([]);
    expect(partitionUploads([file("x/readme.md", { type: "text/markdown" })])).toMatchObject({ images: [], wrongType: 1 });
  });
});
