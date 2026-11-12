import { describe, expect, test } from "vitest";
import {
  checkFile,
  documentRules,
  formatBytes,
  imageRules,
  videoRules,
  type CandidateFile,
} from "../../src/upload/limits";

const png = (overrides: Partial<CandidateFile> = {}): CandidateFile => ({
  name: "photo.png",
  size: 1000,
  type: "image/png",
  ...overrides,
});

describe("presets", () => {
  test("images are capped at 5 MB and refuse SVG", () => {
    expect(imageRules.maxBytes).toBe(5 * 1024 * 1024);
    expect(imageRules.extensions).not.toContain("svg");
    expect(imageRules.mimeTypes).not.toContain("image/svg+xml");
  });

  test("documents allow PDF and refuse images", () => {
    expect(documentRules.extensions).toContain("pdf");
    expect(documentRules.extensions).not.toContain("png");
  });
});

describe("checkFile", () => {
  test("accepts a file that meets every rule", () => {
    expect(checkFile(png(), imageRules, [])).toEqual({ ok: true });
  });

  test("rejects an empty file", () => {
    const result = checkFile(png({ size: 0 }), imageRules, []);
    expect(result).toMatchObject({ ok: false, reason: "empty" });
  });

  test("rejects a file over the cap and names the limit", () => {
    const result = checkFile(png({ size: imageRules.maxBytes + 1 }), imageRules, []);
    expect(result).toMatchObject({ ok: false, reason: "size" });
    if (!result.ok) expect(result.message).toContain("5 MB");
  });

  test("accepts a file exactly at the cap", () => {
    expect(checkFile(png({ size: imageRules.maxBytes }), imageRules, [])).toEqual({ ok: true });
  });

  test.each(["photo.svg", "photo.gif", "photo.exe", "photo", "photo."])(
    "rejects the extension of %s",
    (name) => {
      expect(checkFile(png({ name }), imageRules, [])).toMatchObject({ ok: false, reason: "type" });
    },
  );

  test("rejects a right extension with a wrong type", () => {
    expect(checkFile(png({ type: "text/html" }), imageRules, [])).toMatchObject({
      ok: false,
      reason: "type",
    });
  });

  test("rejects a wrong extension with a right type", () => {
    expect(checkFile(png({ name: "photo.exe", type: "image/png" }), imageRules, [])).toMatchObject({
      ok: false,
      reason: "type",
    });
  });

  test("accepts an empty reported type when the extension is allowed", () => {
    expect(checkFile(png({ type: "" }), imageRules, [])).toEqual({ ok: true });
  });

  test("checks the last extension of a double extension", () => {
    expect(checkFile(png({ name: "a.php.png" }), imageRules, [])).toEqual({ ok: true });
    expect(checkFile(png({ name: "a.png.php" }), imageRules, [])).toMatchObject({
      ok: false,
      reason: "type",
    });
  });

  test("compares extensions without regard to case", () => {
    expect(checkFile(png({ name: "PHOTO.PNG" }), imageRules, [])).toEqual({ ok: true });
  });

  test.each(["dir/photo.png", "dir\\photo.png", "photo\u0000.png"])(
    "rejects the unsafe name %j",
    (name) => {
      expect(checkFile(png({ name }), imageRules, [])).toMatchObject({ ok: false, reason: "name" });
    },
  );

  test("rejects a very long name", () => {
    const name = `${"a".repeat(200)}.png`;
    expect(checkFile(png({ name }), imageRules, [])).toMatchObject({ ok: false, reason: "name" });
  });

  test("rejects a duplicate of a file already chosen", () => {
    const existing = [png()];
    expect(checkFile(png(), imageRules, existing)).toMatchObject({
      ok: false,
      reason: "duplicate",
    });
  });

  test("allows the same name with a different size", () => {
    expect(checkFile(png({ size: 2000 }), imageRules, [png()])).toEqual({ ok: true });
  });

  test("rejects a file past the count limit and frees a slot after removal", () => {
    const rules = { ...imageRules, maxFiles: 2 };
    const two = [png({ name: "a.png" }), png({ name: "b.png" })];
    expect(checkFile(png({ name: "c.png" }), rules, two)).toMatchObject({
      ok: false,
      reason: "count",
    });
    expect(checkFile(png({ name: "c.png" }), rules, two.slice(1))).toEqual({ ok: true });
  });

  test("messages carry no file name", () => {
    const result = checkFile(png({ name: "secret-name.exe" }), imageRules, []);
    if (!result.ok) expect(result.message).not.toContain("secret-name");
  });
});

describe("formatBytes", () => {
  test("uses KB and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
  });
});

describe("videoRules", () => {
  const rules = videoRules(2 * 1024 * 1024 * 1024);
  const mp4 = (overrides: Partial<CandidateFile> = {}): CandidateFile => ({
    name: "welcome.mp4",
    size: 1000,
    type: "video/mp4",
    ...overrides,
  });

  test("accepts the four containers the server accepts", () => {
    for (const [name, type] of [
      ["a.mp4", "video/mp4"],
      ["a.mov", "video/quicktime"],
      ["a.webm", "video/webm"],
      ["a.mkv", "video/x-matroska"],
    ] as const) {
      expect(checkFile(mp4({ name, type }), rules, []).ok).toBe(true);
    }
  });

  test("refuses other types and anything over the cap", () => {
    expect(checkFile(mp4({ name: "a.avi", type: "video/x-msvideo" }), rules, []).ok).toBe(false);
    expect(checkFile(mp4({ name: "a.pdf", type: "application/pdf" }), rules, []).ok).toBe(false);
    const big = checkFile(mp4({ size: rules.maxBytes + 1 }), rules, []);
    expect(big.ok ? "" : big.message).toBe("Files can be at most 2048 MB.");
  });
});
