import { describe, expect, test } from "vitest";
import { escapeHtml } from "../../src/certificate/escape-html";

describe("escapeHtml", () => {
  test("escapes markup characters", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("escapes ampersands once", () => {
    expect(escapeHtml("A & B &amp; C")).toBe("A &amp; B &amp;amp; C");
  });

  test("escapes both quote kinds and backticks", () => {
    expect(escapeHtml(`"x" 'y' \`z\``)).toBe("&quot;x&quot; &#39;y&#39; &#96;z&#96;");
  });

  test("leaves plain text unchanged", () => {
    expect(escapeHtml("Nusrat Jahan")).toBe("Nusrat Jahan");
  });
});
