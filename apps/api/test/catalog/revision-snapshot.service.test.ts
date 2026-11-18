import { describe, expect, test, vi } from "vitest";
import { RevisionSnapshotService } from "../../src/catalog/revision-snapshot.service";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const revisionId = "0198f1a0-0000-7000-8000-0000000000e1";
const latestId = "0198f1a0-0000-7000-8000-0000000000e2";
const imageId = "0198f1a0-0000-7000-8000-0000000000a1";
const at = new Date("2026-11-11T06:00:00.000Z");

const doc = {
  type: "doc",
  content: [
    {
      type: "image",
      attrs: { assetId: imageId, alt: "Poster" },
    },
  ],
};

const revision = (overrides: Record<string, unknown> = {}) => ({
  id: revisionId,
  number: 1,
  publishedAt: at,
  createdAt: at,
  _count: { enrollments: 2 },
  modules: [
    {
      id: "0198f1a0-0000-7000-8000-0000000000b1",
      order: 1,
      title: "Module one",
      objectives: ["Know the policy"],
      lessonSections: [
        { id: "0198f1a0-0000-7000-8000-0000000000d1", order: 1, title: "Intro", body: doc },
      ],
      videos: [
        {
          id: "0198f1a0-0000-7000-8000-0000000000f1",
          order: 1,
          title: "Video A",
          required: true,
          asset: { status: "READY" },
        },
        {
          id: "0198f1a0-0000-7000-8000-0000000000f2",
          order: 2,
          title: "Empty",
          required: false,
          asset: null,
        },
      ],
      quiz: {
        passMarkPercent: 70,
        attemptLimit: null,
        waitMinutes: 10,
        questions: [],
      },
    },
  ],
  ...overrides,
});

const build = (found: unknown, total = 2) => {
  const database = {
    courseRevision: {
      findFirst: vi.fn().mockResolvedValueOnce(found).mockResolvedValueOnce({ id: latestId }),
    },
    mediaAsset: {
      findMany: vi.fn().mockResolvedValue([{ id: imageId, altText: "Poster" }]),
    },
    enrollment: {
      count: vi.fn().mockResolvedValue(total),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "0198f1a0-0000-7000-8000-0000000000aa",
          status: "APPROVED",
          user: {
            id: "0198f1a0-0000-7000-8000-0000000000ab",
            email: "a@du.ac.bd",
            profile: { name: "Amina" },
          },
        },
        {
          id: "0198f1a0-0000-7000-8000-0000000000ac",
          status: "PENDING_APPROVAL",
          user: {
            id: "0198f1a0-0000-7000-8000-0000000000ad",
            email: "b@du.ac.bd",
            profile: null,
          },
        },
      ]),
    },
  };
  const media = { describe: vi.fn().mockReturnValue({ url: "/media/poster.webp" }) };
  const service = new RevisionSnapshotService(database as never, media as never);
  return { service, database };
};

describe("RevisionSnapshotService.get", () => {
  test("returns the modules, resolved images and the enrolled students", async () => {
    const { service } = build(revision());
    const result = await service.get(courseId, revisionId);

    expect(result.revision).toMatchObject({ number: 1, status: "PUBLISHED", current: false });
    expect(result.modules[0]?.sections[0]?.images).toEqual([
      { assetId: imageId, url: "/media/poster.webp", alt: "Poster" },
    ]);
    expect(result.modules[0]?.videos.map((video) => video.status)).toEqual([
      "READY",
      "NOT_UPLOADED",
    ]);
    expect(result.modules[0]?.quiz).toMatchObject({ passMarkPercent: 70, attemptLimit: null });
    expect(result.students.total).toBe(2);
    expect(result.students.items.map((student) => student.name)).toEqual(["Amina", "b@du.ac.bd"]);
  });

  test("marks the newest revision as current", async () => {
    const { service } = build(revision({ id: latestId, number: 2, publishedAt: null }));
    expect((await service.get(courseId, latestId)).revision).toMatchObject({
      current: true,
      status: "DRAFT",
    });
  });

  test("reads only the students enrolled on this revision and skips images when there are none", async () => {
    const { service, database } = build(
      revision({ modules: [{ ...revision().modules[0], lessonSections: [] }] }),
    );
    await service.get(courseId, revisionId);
    expect(database.mediaAsset.findMany).not.toHaveBeenCalled();
    expect(database.enrollment.count).toHaveBeenCalledWith({
      where: { courseRevisionId: revisionId, deletedAt: null },
    });
  });

  test("refuses a revision that is not part of the course", async () => {
    const { service } = build(null);
    await expect(service.get(courseId, revisionId)).rejects.toMatchObject({ status: 404 });
  });
});
