import { beforeEach, describe, expect, test, vi } from "vitest";

const launch = vi.hoisted(() => vi.fn());

vi.mock("playwright-core", () => ({ chromium: { launch } }));

import {
  CHROMIUM_ARGUMENTS,
  ChromiumPdfRenderer,
  isOfflineRequest,
  withDeadline,
} from "../../src/certificate/chromium-pdf-renderer";

interface Route {
  request: () => { url: () => string };
  continue: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
}

const buildBrowser = (options: { setContent?: () => Promise<void> } = {}) => {
  const page = {
    setContent: vi.fn().mockImplementation(options.setContent ?? (() => Promise.resolve())),
    pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF")),
  };
  const context = {
    route: vi.fn().mockResolvedValue(undefined),
    newPage: vi.fn().mockResolvedValue(page),
  };
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { browser, context, page };
};

const route = (url: string): Route => ({
  request: () => ({ url: () => url }),
  continue: vi.fn(),
  abort: vi.fn(),
});

beforeEach(() => {
  launch.mockReset();
});

describe("isOfflineRequest", () => {
  test.each(["data:image/png;base64,AAAA", "about:blank"])("allows %s", (url) => {
    expect(isOfflineRequest(url)).toBe(true);
  });

  test.each([
    "https://example.com/logo.png",
    "http://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "ftp://host/file",
  ])("blocks %s", (url) => {
    expect(isOfflineRequest(url)).toBe(false);
  });
});

describe("withDeadline", () => {
  test("returns the result when the work finishes in time", async () => {
    await expect(withDeadline(Promise.resolve("done"), 1000)).resolves.toBe("done");
  });

  test("rejects when the work takes too long", async () => {
    await expect(withDeadline(new Promise<string>(() => undefined), 5)).rejects.toThrow(
      "timed out",
    );
  });
});

describe("ChromiumPdfRenderer", () => {
  test("prints an A4 landscape pdf with javascript off and the network locked", async () => {
    const { browser, context, page } = buildBrowser();
    launch.mockResolvedValue(browser);

    const pdf = await new ChromiumPdfRenderer("/usr/bin/chromium", 5000).render("<p>x</p>");

    expect(Buffer.from(pdf).toString()).toBe("%PDF");
    expect(launch).toHaveBeenCalledWith({
      executablePath: "/usr/bin/chromium",
      args: [...CHROMIUM_ARGUMENTS],
      timeout: 5000,
    });
    expect(browser.newContext).toHaveBeenCalledWith({
      javaScriptEnabled: false,
      offline: true,
      serviceWorkers: "block",
    });
    expect(page.setContent).toHaveBeenCalledWith("<p>x</p>", { waitUntil: "load", timeout: 5000 });
    expect(page.pdf).toHaveBeenCalledWith({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
    });
    expect(browser.close).toHaveBeenCalledTimes(1);
    const handler = context.route.mock.calls[0]?.[1] as (route: Route) => void;
    const remote = route("https://example.com/x.png");
    const inline = route("data:image/png;base64,AAAA");
    handler(remote);
    handler(inline);
    expect(remote.abort).toHaveBeenCalled();
    expect(remote.continue).not.toHaveBeenCalled();
    expect(inline.continue).toHaveBeenCalled();
    expect(inline.abort).not.toHaveBeenCalled();
  });

  test("blocks name resolution in the browser", () => {
    expect(CHROMIUM_ARGUMENTS).toContain("--host-resolver-rules=MAP * ~NOTFOUND");
  });

  test("closes the browser and fails when the render times out", async () => {
    const { browser } = buildBrowser({ setContent: () => new Promise(() => undefined) });
    launch.mockResolvedValue(browser);

    await expect(new ChromiumPdfRenderer(undefined, 20).render("<p>x</p>")).rejects.toThrow(
      "timed out",
    );
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  test("closes the browser when rendering throws", async () => {
    const { browser } = buildBrowser({ setContent: () => Promise.reject(new Error("crash")) });
    launch.mockResolvedValue(browser);

    await expect(new ChromiumPdfRenderer(undefined, 1000).render("<p>x</p>")).rejects.toThrow(
      "crash",
    );
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  test("fails without a browser to close when launch fails", async () => {
    launch.mockRejectedValue(new Error("no executable"));
    await expect(new ChromiumPdfRenderer(undefined, 1000).render("x")).rejects.toThrow(
      "no executable",
    );
  });
});
