import { messages } from "@heat/i18n";
import { beforeEach, describe, expect, test, vi } from "vitest";

const rootLocale = vi.fn<() => Promise<string | undefined>>();

vi.mock("next/root-params", () => ({ locale: () => rootLocale() }));
vi.mock("next-intl/server", () => ({
  getRequestConfig: (factory: () => unknown) => factory,
}));

type Factory = () => Promise<{
  locale: string;
  messages: unknown;
  timeZone: string;
  onError: unknown;
  getMessageFallback: unknown;
}>;

async function load() {
  const loaded = await import("../../src/i18n/request");
  return loaded.default as unknown as Factory;
}

beforeEach(() => {
  rootLocale.mockReset();
});

describe("request config", () => {
  test.each(["bn", "en"] as const)(
    "returns the %s catalog and the Dhaka time zone",
    async (locale) => {
      rootLocale.mockResolvedValue(locale);
      const config = await (await load())();
      expect(config.locale).toBe(locale);
      expect(config.messages).toBe(messages[locale]);
      expect(config.timeZone).toBe("Asia/Dhaka");
    },
  );

  test("installs the error handlers", async () => {
    rootLocale.mockResolvedValue("en");
    const config = await (await load())();
    const { onError, getMessageFallback } = await import("../../src/i18n/handlers");
    expect(config.onError).toBe(onError);
    expect(config.getMessageFallback).toBe(getMessageFallback);
  });

  test.each(["fr", "BN", "sign-in", "", undefined])(
    "renders a 404 for the segment %j",
    async (value) => {
      rootLocale.mockResolvedValue(value);
      const factory = await load();
      await expect(factory()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    },
  );
});
