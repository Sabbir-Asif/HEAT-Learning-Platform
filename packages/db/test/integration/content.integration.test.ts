import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { withDatabase, type TestDatabase } from "./helpers";

let database: TestDatabase;

beforeAll(async () => {
  database = await withDatabase();
});

afterAll(async () => {
  await database.close();
});

const unique = () => Math.random().toString(36).slice(2);

const createAdmin = () =>
  database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "ADMIN",
      realm: "ADMIN",
    },
  });

const assetData = (uploaderId: string) => ({
  key: `media/${unique()}.png`,
  kind: "IMAGE" as const,
  mimeType: "image/png",
  sizeBytes: 2048,
  sha256: "b".repeat(64),
  uploaderId,
});

describe("media assets", () => {
  test("an asset is private until made visible, and starts with no variants", async () => {
    const admin = await createAdmin();

    const asset = await database.prisma.mediaAsset.create({ data: assetData(admin.id) });

    expect(asset.visibility).toBe("PRIVATE");
    expect(asset.variants).toEqual([]);
    expect(asset.altText).toBeNull();
  });

  test("an asset keeps its dimensions, alt text and linked record", async () => {
    const admin = await createAdmin();
    const linkedId = crypto.randomUUID();

    const asset = await database.prisma.mediaAsset.create({
      data: {
        ...assetData(admin.id),
        visibility: "PUBLIC",
        width: 800,
        height: 600,
        altText: "A lecture hall",
        linkedEntity: "NewsPost",
        linkedId,
      },
    });

    expect(asset).toMatchObject({ width: 800, height: 600, linkedEntity: "NewsPost", linkedId });
  });

  test("two assets cannot share a storage key", async () => {
    const admin = await createAdmin();
    const data = assetData(admin.id);
    await database.prisma.mediaAsset.create({ data });

    await expect(database.prisma.mediaAsset.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("a checksum that is not 64 hex characters is rejected", async () => {
    const admin = await createAdmin();

    await expect(
      database.prisma.mediaAsset.create({ data: { ...assetData(admin.id), sha256: "short" } }),
    ).rejects.toThrow(/MediaAsset_sha256_sha256_check/);
  });

  test("an empty file is rejected", async () => {
    const admin = await createAdmin();

    await expect(
      database.prisma.mediaAsset.create({ data: { ...assetData(admin.id), sizeBytes: 0 } }),
    ).rejects.toThrow(/MediaAsset_sizeBytes_check/);
  });

  test("an uploader with assets cannot be hard deleted", async () => {
    const admin = await createAdmin();
    await database.prisma.mediaAsset.create({ data: assetData(admin.id) });

    await expect(database.prisma.user.delete({ where: { id: admin.id } })).rejects.toMatchObject({
      code: "P2003",
    });
  });
});

describe("resources", () => {
  test("a link resource needs a URL and no file", async () => {
    const resource = await database.prisma.resource.create({
      data: { title: "Hotline", kind: "LINK", url: "https://example.com/hotline" },
    });

    expect(resource.courseId).toBeNull();
    expect(resource.mediaAssetId).toBeNull();
  });

  test("a link without a URL is rejected", async () => {
    await expect(
      database.prisma.resource.create({ data: { title: "Hotline", kind: "LINK" } }),
    ).rejects.toThrow(/Resource_kind_target_check/);
  });

  test("a file resource needs an asset and no URL", async () => {
    const admin = await createAdmin();
    const asset = await database.prisma.mediaAsset.create({ data: assetData(admin.id) });

    const resource = await database.prisma.resource.create({
      data: { title: "Policy", kind: "FILE", mediaAssetId: asset.id },
    });

    expect(resource.mediaAssetId).toBe(asset.id);
  });

  test("a file without an asset is rejected", async () => {
    await expect(
      database.prisma.resource.create({ data: { title: "Policy", kind: "FILE" } }),
    ).rejects.toThrow(/Resource_kind_target_check/);
  });

  test("a file that also has a URL is rejected", async () => {
    const admin = await createAdmin();
    const asset = await database.prisma.mediaAsset.create({ data: assetData(admin.id) });

    await expect(
      database.prisma.resource.create({
        data: { title: "Policy", kind: "FILE", mediaAssetId: asset.id, url: "https://example.com" },
      }),
    ).rejects.toThrow(/Resource_kind_target_check/);
  });

  test("a resource can belong to a course", async () => {
    const course = await database.prisma.course.create({
      data: { slug: `course-${unique()}`, title: "Gender safety" },
    });

    const resource = await database.prisma.resource.create({
      data: { courseId: course.id, title: "Reading", kind: "LINK", url: "https://example.com" },
    });

    expect(resource.courseId).toBe(course.id);
  });
});

describe("news posts", () => {
  test("a post is a draft until it has a publish date", async () => {
    const admin = await createAdmin();

    const post = await database.prisma.newsPost.create({
      data: {
        authorId: admin.id,
        slug: `post-${unique()}`,
        title: "Orientation",
        body: { type: "doc", content: [] },
        schemaVersion: 1,
      },
    });

    expect(post.publishedAt).toBeNull();
  });

  test("two posts cannot share a slug", async () => {
    const admin = await createAdmin();
    const data = {
      authorId: admin.id,
      slug: `post-${unique()}`,
      title: "Orientation",
      body: { type: "doc", content: [] },
      schemaVersion: 1,
    };
    await database.prisma.newsPost.create({ data });

    await expect(database.prisma.newsPost.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("an author with posts cannot be hard deleted", async () => {
    const admin = await createAdmin();
    await database.prisma.newsPost.create({
      data: {
        authorId: admin.id,
        slug: `post-${unique()}`,
        title: "Orientation",
        body: {},
        schemaVersion: 1,
      },
    });

    await expect(database.prisma.user.delete({ where: { id: admin.id } })).rejects.toMatchObject({
      code: "P2003",
    });
  });
});

describe("contact details", () => {
  test("contact details are stored as a site setting", async () => {
    const setting = await database.prisma.siteSetting.create({
      data: { key: `contact-${unique()}`, value: { email: "heat@example.com", phone: "01700" } },
    });

    expect(setting.value).toEqual({ email: "heat@example.com", phone: "01700" });
  });
});
