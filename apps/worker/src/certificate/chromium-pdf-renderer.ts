import { chromium } from "playwright-core";
import type { PdfRenderer } from "./certificate-ports";

export const CHROMIUM_ARGUMENTS = [
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--host-resolver-rules=MAP * ~NOTFOUND",
] as const;

export const isOfflineRequest = (url: string): boolean =>
  url.startsWith("data:") || url.startsWith("about:");

export const withDeadline = async <T>(work: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Chromium render timed out")), timeoutMs);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
};

export class ChromiumPdfRenderer implements PdfRenderer {
  constructor(
    private readonly executablePath: string | undefined,
    private readonly timeoutMs: number,
  ) {}

  async render(html: string): Promise<Uint8Array> {
    const browser = await chromium.launch({
      executablePath: this.executablePath,
      args: [...CHROMIUM_ARGUMENTS],
      timeout: this.timeoutMs,
    });
    try {
      return await withDeadline(this.print(browser, html), this.timeoutMs);
    } finally {
      await browser.close();
    }
  }

  private async print(
    browser: Awaited<ReturnType<typeof chromium.launch>>,
    html: string,
  ): Promise<Uint8Array> {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      offline: true,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) =>
      isOfflineRequest(route.request().url()) ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: this.timeoutMs });
    return page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
    });
  }
}
