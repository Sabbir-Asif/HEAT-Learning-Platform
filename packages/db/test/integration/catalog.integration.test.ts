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

const createRevision = async () => {
  const course = await database.prisma.course.create({
    data: { slug: `course-${unique()}`, title: "Gender safety" },
  });
  const revision = await database.prisma.courseRevision.create({
    data: { courseId: course.id, number: 1 },
  });
  return { course, revision };
};

const createModule = async (revisionId: string, order: number) =>
  database.prisma.module.create({ data: { revisionId, order, title: `Module ${order}` } });

const createAsset = () =>
  database.prisma.videoAsset.create({ data: { assetKey: `asset-${unique()}` } });

describe("ordering", () => {
  test("two modules cannot share an order in one revision", async () => {
    const { revision } = await createRevision();
    await createModule(revision.id, 1);

    await expect(createModule(revision.id, 1)).rejects.toMatchObject({ code: "P2002" });
  });

  test("the same order is allowed in a different revision", async () => {
    const first = await createRevision();
    const second = await createRevision();
    await createModule(first.revision.id, 1);

    const module = await createModule(second.revision.id, 1);

    expect(module.order).toBe(1);
  });

  test("two videos cannot share an order in one module", async () => {
    const { revision } = await createRevision();
    const module = await createModule(revision.id, 1);
    const asset = await createAsset();
    const data = { moduleId: module.id, order: 1, title: "Intro", assetId: asset.id };
    await database.prisma.video.create({ data });

    await expect(database.prisma.video.create({ data })).rejects.toMatchObject({ code: "P2002" });
  });

  test("two revisions of one course cannot share a number", async () => {
    const { course } = await createRevision();

    await expect(
      database.prisma.courseRevision.create({ data: { courseId: course.id, number: 1 } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  test("a module has one lesson section per order", async () => {
    const { revision } = await createRevision();
    const module = await createModule(revision.id, 1);
    const data = {
      moduleId: module.id,
      order: 1,
      body: { type: "doc", content: [] },
      schemaVersion: 1,
      objectives: ["Recognise harassment"],
    };
    await database.prisma.lessonSection.create({ data });

    await expect(database.prisma.lessonSection.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });
});

describe("media is referenced by asset key", () => {
  test("no catalog table has a path or url column", async () => {
    const result = await database.query(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and table_name in ('Course', 'CourseRevision', 'Module', 'LessonSection', 'Video',
                            'VideoAsset', 'VideoRendition', 'VideoCaption', 'Tag')
         and (lower(column_name) like '%path%' or lower(column_name) like '%url%')`,
    );

    expect(result.rows).toEqual([]);
  });

  test("an asset key is unique", async () => {
    const data = { assetKey: `asset-${unique()}` };
    await database.prisma.videoAsset.create({ data });

    await expect(database.prisma.videoAsset.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("a video needs an existing asset", async () => {
    const { revision } = await createRevision();
    const module = await createModule(revision.id, 1);

    await expect(
      database.prisma.video.create({
        data: { moduleId: module.id, order: 1, title: "Intro", assetId: crypto.randomUUID() },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("an asset used by a video cannot be hard deleted", async () => {
    const { revision } = await createRevision();
    const module = await createModule(revision.id, 1);
    const asset = await createAsset();
    await database.prisma.video.create({
      data: { moduleId: module.id, order: 1, title: "Intro", assetId: asset.id },
    });

    await expect(
      database.prisma.videoAsset.delete({ where: { id: asset.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("an asset keeps one caption per language and one rendition per label", async () => {
    const asset = await createAsset();
    await database.prisma.videoCaption.create({
      data: { assetId: asset.id, language: "en", captionKey: `caption-${unique()}` },
    });
    await database.prisma.videoRendition.create({ data: { assetId: asset.id, label: "720p" } });

    await expect(
      database.prisma.videoCaption.create({
        data: { assetId: asset.id, language: "en", captionKey: `caption-${unique()}` },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      database.prisma.videoRendition.create({ data: { assetId: asset.id, label: "720p" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  test("a reference count cannot go negative", async () => {
    const asset = await createAsset();

    await expect(
      database.prisma.videoAsset.update({
        where: { id: asset.id },
        data: { referenceCount: -1 },
      }),
    ).rejects.toThrow(/check|constraint/i);
  });
});

describe("courses, tags and settings", () => {
  test("a course slug is unique", async () => {
    const data = { slug: `course-${unique()}`, title: "Gender safety" };
    await database.prisma.course.create({ data });

    await expect(database.prisma.course.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("a new course is a draft and unlocked", async () => {
    const { course } = await createRevision();

    expect(course.status).toBe("DRAFT");
    expect(course.lockedAt).toBeNull();
  });

  test("the reserved frontpage tag is a system tag with a unique slug", async () => {
    const tag = await database.prisma.tag.create({
      data: { slug: `frontpage-${unique()}`, name: "Front page", isSystem: true },
    });

    expect(tag.isSystem).toBe(true);
    await expect(
      database.prisma.tag.create({ data: { slug: tag.slug, name: "Other" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  test("a course carries a tag once, with a display order", async () => {
    const { course } = await createRevision();
    const tag = await database.prisma.tag.create({
      data: { slug: `tag-${unique()}`, name: "Featured" },
    });
    const data = { courseId: course.id, tagId: tag.id, displayOrder: 1 };
    await database.prisma.courseTag.create({ data });

    await expect(database.prisma.courseTag.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("a module carries a tag once, with a display order", async () => {
    const { revision } = await createRevision();
    const module = await createModule(revision.id, 1);
    const tag = await database.prisma.tag.create({
      data: { slug: `tag-${unique()}`, name: "Featured" },
    });
    const data = { moduleId: module.id, tagId: tag.id, displayOrder: 1 };
    await database.prisma.moduleTag.create({ data });

    await expect(database.prisma.moduleTag.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("a site setting key is unique", async () => {
    const data = { key: `setting-${unique()}`, value: { title: "HEAT" } };
    await database.prisma.siteSetting.create({ data });

    await expect(database.prisma.siteSetting.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("a revision with modules cannot be hard deleted", async () => {
    const { revision } = await createRevision();
    await createModule(revision.id, 1);

    await expect(
      database.prisma.courseRevision.delete({ where: { id: revision.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
