import { describe, expect, test } from "vitest";
import { ChromiumPdfRenderer } from "../../src/certificate/chromium-pdf-renderer";
import { renderCertificateHtml } from "../../src/certificate/render-certificate-html";

const executablePath = process.env["CHROMIUM_EXECUTABLE_PATH"];

describe.skipIf(executablePath === undefined || executablePath === "")("real Chromium", () => {
  test("renders the certificate template to a pdf", async () => {
    const html = renderCertificateHtml({
      holderName: "Amina Rahman",
      courseTitle: "Gender Safety Basics",
      completedAt: new Date("2026-11-10T08:00:00.000Z"),
      number: "ABCD-EFGH-JKMN",
    });

    const pdf = await new ChromiumPdfRenderer(executablePath, 60000).render(html);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  }, 90000);
});
