import { describe, expect, test, vi } from "vitest";
import { StudentExportService, exportBatchSize } from "../../src/students/student-export.service";

const row = (id: string, name: string) => ({
  id,
  status: "APPROVED",
  requestedAt: new Date("2026-11-01T00:00:00Z"),
  approvedAt: null,
  completedAt: null,
  course: { title: "HEAT" },
  courseRevision: { _count: { modules: 4 } },
  _count: { moduleProgress: 1 },
  user: {
    email: `${id}@du.ac.bd`,
    profile: {
      name,
      session: "2020-21",
      department: {
        name: "Law",
        universityFaculty: { university: { name: "DU" }, faculty: { name: "Law" } },
      },
    },
  },
});

const collect = async (stream: AsyncGenerator<string>): Promise<string> => {
  let text = "";
  for await (const part of stream) text += part;
  return text;
};

const actor = { actorId: "admin" };

describe("StudentExportService", () => {
  test("streams the header, escaped rows and records an audit entry", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([row("a", "=cmd"), row("b", 'Ann, "A"')])
      .mockResolvedValueOnce([]);
    const recordStandalone = vi.fn().mockResolvedValue(undefined);
    const service = new StudentExportService(
      { enrollment: { findMany } } as never,
      { recordStandalone } as never,
    );

    const filters = { status: "APPROVED" as const };
    const text = await collect(service.stream(filters, actor, new AbortController().signal));

    const lines = text.replace("﻿", "").split("\r\n");
    expect(lines[0]).toMatch(/^Name,Email,/);
    expect(lines[1]).toMatch(
      /^'=cmd,a@du.ac.bd,DU,Law,Law,2020-21,HEAT,APPROVED,2026-11-01 06:00,,,1 of 4 modules$/,
    );
    expect(lines[2]).toMatch(/^"Ann, ""A""",/);
    expect(recordStandalone).toHaveBeenCalledWith(actor, {
      action: "students.export",
      entity: "StudentExport",
      after: { filters, rowCount: 2, completed: true },
    });
  });

  test("reads in bounded batches by keyset and continues after a full batch", async () => {
    const full = Array.from({ length: exportBatchSize }, (_, index) => row(`id-${index}`, "N"));
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce([row("z", "Z")]);
    const service = new StudentExportService(
      { enrollment: { findMany } } as never,
      { recordStandalone: vi.fn() } as never,
    );

    await collect(service.stream({}, actor, new AbortController().signal));

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0]?.[0].take).toBe(exportBatchSize);
    expect(JSON.stringify(findMany.mock.calls[1]?.[0].where)).toContain(
      `"id":{"gt":"id-${exportBatchSize - 1}"}`,
    );
  });

  test("stops reading and audits as incomplete when the client aborts", async () => {
    const abort = new AbortController();
    const findMany = vi.fn().mockImplementation(async () => {
      abort.abort();
      return Array.from({ length: exportBatchSize }, (_, index) => row(`id-${index}`, "N"));
    });
    const recordStandalone = vi.fn().mockResolvedValue(undefined);
    const service = new StudentExportService(
      { enrollment: { findMany } } as never,
      { recordStandalone } as never,
    );

    await collect(service.stream({}, actor, abort.signal));

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(recordStandalone.mock.calls[0]?.[1].after).toMatchObject({ completed: false });
  });

  test("audits when the consumer stops early", async () => {
    const findMany = vi.fn().mockResolvedValue([row("a", "A")]);
    const recordStandalone = vi.fn().mockResolvedValue(undefined);
    const service = new StudentExportService(
      { enrollment: { findMany } } as never,
      { recordStandalone } as never,
    );

    const stream = service.stream({}, actor, new AbortController().signal);
    await stream.next();
    await stream.next();
    await stream.return(undefined);

    expect(recordStandalone).toHaveBeenCalledTimes(1);
  });
});
