import { Writable } from "node:stream";
import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { StudentExportController } from "../../src/enrollment/student-export.controller";

const waitFor = (output: Writable) => new Promise((resolve) => output.once("finish", resolve));

describe("StudentExportController", () => {
  test("is admin only", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, StudentExportController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, StudentExportController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("streams the CSV with download headers and no caching", async () => {
    const chunks: string[] = [];
    const response = Object.assign(
      new Writable({
        write(chunk, _encoding, done) {
          chunks.push(String(chunk));
          done();
        },
      }),
      { setHeader: vi.fn() },
    );
    async function* body() {
      yield "a,b\r\n";
    }
    const stream = vi.fn().mockReturnValue(body());
    const controller = new StudentExportController({ stream } as never);

    controller.download(
      { status: "APPROVED" } as never,
      { userId: "admin" } as never,
      { ip: "203.0.113.4", headers: {} } as never,
      response as never,
    );
    await waitFor(response);

    expect(chunks.join("")).toBe("a,b\r\n");
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="students.csv"',
    );
    expect(stream.mock.calls[0]?.[0]).toEqual({ status: "APPROVED" });
  });

  test("aborts the stream when the response closes before finishing", async () => {
    const response = Object.assign(new Writable({ write: (_c, _e, done) => done() }), {
      setHeader: vi.fn(),
    });
    let signal: AbortSignal | undefined;
    const stream = vi.fn().mockImplementation(async function* (_q, _a, given: AbortSignal) {
      signal = given;
      yield "x";
      await new Promise(() => undefined);
    });
    const controller = new StudentExportController({ stream } as never);

    controller.download(
      {} as never,
      { userId: "a" } as never,
      { headers: {} } as never,
      response as never,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    response.destroy();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(signal?.aborted).toBe(true);
  });
});
