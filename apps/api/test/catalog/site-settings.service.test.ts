import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { SiteSettingsService } from "../../src/catalog/site-settings.service";

const settingId = "0198f1a0-0000-7000-8000-0000000000e1";
const assetId = "0198f1a0-0000-7000-8000-0000000000a1";
const at = new Date("2026-11-12T06:00:00.000Z");

const doc = (...content: unknown[]) => ({ type: "doc", content });

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

const request = (overrides: Record<string, unknown> = {}) => ({
  heading: "About the project",
  schemaVersion: 1 as const,
  body: doc(paragraph("Hello")),
  imageAssetId: null,
  ...overrides,
});

const build = (options: { stored?: unknown; assets?: unknown[] } = {}) => {
  const database = {
    siteSetting: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.stored === undefined ? null : { value: options.stored, updatedAt: at },
        ),
      upsert: vi.fn().mockResolvedValue({ id: settingId, updatedAt: at }),
    },
    mediaAsset: {
      findMany: vi.fn().mockResolvedValue(options.assets ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const service = new SiteSettingsService(
    database as never,
    new AuditService({} as never),
    { describe: vi.fn().mockReturnValue({ url: "/media/x/w640.webp" }) } as never,
    { revalidate } as never,
  );
  const changes: AuditChange[] = [];
  const afterCommit: Array<() => Promise<void>> = [];
  const scope = { tx: database as never, changes, afterCommit, skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, afterCommit, revalidate, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("SiteSettingsService.admin", () => {
  test("returns an empty overview before anything is saved", async () => {
    const { service } = build();
    const result = await service.admin();
    expect(result).toMatchObject({ heading: "", imageAssetId: null, updatedAt: null, images: [] });
  });
});

describe("SiteSettingsService.update", () => {
  test("stores the overview, audits before and after and revalidates the landing tag", async () => {
    const { service, database, changes, afterCommit, revalidate, inAuditScope } = build({
      stored: { heading: "Old", schemaVersion: 1, body: doc(), imageAssetId: null },
    });
    const result = await inAuditScope(() => service.update(request()));
    expect(database.siteSetting.upsert).toHaveBeenCalledOnce();
    expect(result.heading).toBe("About the project");
    expect(changes).toHaveLength(1);
    expect(changes[0]?.before).toMatchObject({ heading: "Old" });
    expect(changes[0]?.after).toMatchObject({ heading: "About the project" });
    await afterCommit[0]?.();
    expect(revalidate).toHaveBeenCalledWith(["landing"]);
  });

  test("keeps the media asset id, never a url, in the stored body", async () => {
    const image = { type: "image", attrs: { assetId, alt: "Team" } };
    const { service, database, inAuditScope } = build({
      assets: [{ id: assetId, linkedEntity: null, linkedId: null, altText: "Team" }],
    });
    await inAuditScope(() => service.update(request({ body: doc(image) })));
    const stored = JSON.stringify(database.siteSetting.upsert.mock.calls[0]?.[0]);
    expect(stored).toContain(assetId);
    expect(stored).not.toContain("/media/");
    expect(database.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { linkedEntity: "SiteSetting", linkedId: settingId } }),
    );
  });

  test("rejects a body outside the allow-list without writing", async () => {
    const { service, database, inAuditScope } = build();
    const unsafe = doc({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "x",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    });
    const error = await failureOf(inAuditScope(() => service.update(request({ body: unsafe }))));
    expect(error).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(database.siteSetting.upsert).not.toHaveBeenCalled();
  });

  test("rejects an image asset that belongs to another entity", async () => {
    const { service, inAuditScope } = build({
      assets: [{ id: assetId, linkedEntity: "LessonSection", linkedId: "other" }],
    });
    const error = await failureOf(
      inAuditScope(() => service.update(request({ imageAssetId: assetId }))),
    );
    expect(error).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  test("rejects an image asset that does not exist", async () => {
    const { service, inAuditScope } = build({ assets: [] });
    const error = await failureOf(
      inAuditScope(() => service.update(request({ imageAssetId: assetId }))),
    );
    expect(error).toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("SiteSettingsService.public", () => {
  test("returns the saved overview with the resolved heading image", async () => {
    const { service } = build({
      stored: { heading: "Hi", schemaVersion: 1, body: doc(paragraph("x")), imageAssetId: assetId },
      assets: [{ id: assetId, altText: "Team" }],
    });
    const result = await service.public();
    expect(result.image).toEqual({ assetId, url: "/media/x/w640.webp", alt: "Team" });
  });
});
