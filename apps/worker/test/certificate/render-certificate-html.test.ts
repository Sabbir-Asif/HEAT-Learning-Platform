import jsQR from "jsqr";
import { describe, expect, test } from "vitest";
import { loadCertificateConfig } from "../../src/certificate/certificate-config";
import {
  formatCompletionDate,
  renderCertificateHtml,
  type CertificateRenderData,
} from "../../src/certificate/render-certificate-html";

const config = loadCertificateConfig({ PUBLIC_APP_URL: "https://learn.example.org" });

const fixture: CertificateRenderData = {
  holderName: "Nusrat Jahan",
  courseTitle: "Gender Safety on Campus",
  completedAt: new Date("2026-11-11T20:30:00Z"),
  number: "ABCD-0123-WXYZ",
};

const render = (overrides: Partial<CertificateRenderData> = {}) =>
  renderCertificateHtml({ ...fixture, ...overrides }, config);

describe("renderCertificateHtml", () => {
  test("shows the stored name, course, Asia/Dhaka date, number and a QR code", () => {
    const html = render();
    expect(html).toContain("Nusrat Jahan");
    expect(html).toContain("Gender Safety on Campus");
    expect(html).toContain("12 November 2026");
    expect(html).toContain("ABCD-0123-WXYZ");
    expect(html).toContain("<svg");
  });

  test("formats the completion date in Asia/Dhaka time", () => {
    expect(formatCompletionDate(new Date("2026-11-11T17:59:00Z"))).toBe("11 November 2026");
    expect(formatCompletionDate(new Date("2026-11-11T18:00:00Z"))).toBe("12 November 2026");
  });

  test("declares A4 landscape print CSS", () => {
    expect(render()).toContain("@page { size: A4 landscape; margin: 0; }");
  });

  test("escapes markup, ampersands and quotes in every dynamic value", () => {
    const html = render({
      holderName: `<script>alert("x")</script> & O'Neil`,
      courseTitle: "<img src=x onerror=alert(1)>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; O&#39;Neil");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  test("escapes the configured wording", () => {
    const html = renderCertificateHtml(
      fixture,
      loadCertificateConfig({
        PUBLIC_APP_URL: "https://learn.example.org",
        CERTIFICATE_SIGNATORY_ONE_NAME: "<b>Dr</b>",
      }),
    );
    expect(html).toContain("&lt;b&gt;Dr&lt;/b&gt;");
    expect(html).not.toContain("<b>Dr</b>");
  });

  test("shrinks the name for 80 or more characters and keeps wrapping safe", () => {
    const html = render({ holderName: "Abdullah ".repeat(10).trim() });
    expect(html).toMatch(/class="holder" style="font-size: (\d+)px"/);
    const size = Number(/class="holder" style="font-size: (\d+)px"/.exec(html)?.[1]);
    expect(size).toBeLessThan(44);
    expect(html).toContain("overflow-wrap: anywhere");
    expect(html).toContain("max-height: 30mm");
  });

  test("references no remote resource", () => {
    const html = render();
    const verifyUrl = "https://learn.example.org/verify/ABCD-0123-WXYZ";
    expect(html.split(verifyUrl).join("")).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/(href|src)="(?!data:image\/png;base64,)/);
    expect(html).not.toMatch(/url\(/);
    expect(html).not.toMatch(/@import|<link|<script/);
  });

  test("uses the configured placeholder wording", () => {
    const html = renderCertificateHtml(fixture, loadCertificateConfig({}));
    expect(html).toContain("Certificate of Completion");
    expect(html).toContain("Name of the Project Director");
  });

  test("embeds a QR code that decodes to the verification URL", () => {
    const svg = /<svg[\s\S]*?<\/svg>/.exec(render())?.[0] ?? "";
    const total = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]);
    const scale = 8;
    const side = total * scale;
    const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
    for (const match of (/<path d="([^"]*)"/.exec(svg)?.[1] ?? "").matchAll(
      /M(\d+) (\d+)h1v1h-1z/g,
    )) {
      for (let y = Number(match[2]) * scale; y < (Number(match[2]) + 1) * scale; y += 1) {
        for (let x = Number(match[1]) * scale; x < (Number(match[1]) + 1) * scale; x += 1) {
          pixels.fill(0, (y * side + x) * 4, (y * side + x) * 4 + 3);
        }
      }
    }
    expect(jsQR(pixels, side, side)?.data).toBe("https://learn.example.org/verify/ABCD-0123-WXYZ");
  });

  test("matches the stored snapshot for the fixed fixture", async () => {
    const masked = render().replaceAll(
      /data:image\/png;base64,[A-Za-z0-9+/=]+/g,
      "data:image/png;base64,LOGO",
    );
    await expect(masked).toMatchFileSnapshot("./__snapshots__/certificate.html.txt");
  });

  test("contains no comments", () => {
    expect(render()).not.toMatch(/<!--|\/\*|\*\//);
  });
});
