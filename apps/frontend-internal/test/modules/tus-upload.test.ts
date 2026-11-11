import { describe, expect, test, vi } from "vitest";
import { TusUploadError, createTusUpload, type TusSend } from "../../src/modules/tus-upload";

const createUrl = "/admin/courses/c/modules/m/videos/v/upload";
const location = "/api/admin/courses/c/modules/m/videos/v/upload/key";

const file = (size: number): File => new File([new Uint8Array(size)], "welcome.mp4");

const created = () => new Response(null, { status: 201, headers: { Location: location } });
const offsetOf = (value: number) =>
  new Response(null, { status: 200, headers: { "Upload-Offset": String(value) } });
const patched = (value: number) =>
  new Response(null, { status: 204, headers: { "Upload-Offset": String(value) } });
const failure = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { code, message: "x", requestId: "r" } }), { status });

interface Call {
  method: string;
  url: string;
  offset: string | null;
  length: string | null;
  bytes: number | null;
}

const harness = (script: Array<(call: Call, signal: AbortSignal | null) => Promise<Response>>) => {
  const calls: Call[] = [];
  const send = vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    const call: Call = {
      method: init.method ?? "GET",
      url,
      offset: headers.get("Upload-Offset"),
      length: headers.get("Upload-Length"),
      bytes: init.body instanceof Blob ? init.body.size : null,
    };
    calls.push(call);
    const next = script.shift();
    if (next === undefined) throw new Error(`unexpected ${call.method} ${call.url}`);
    return next(call, init.signal ?? null);
  });
  return { calls, send };
};

const options = (send: TusSend) => ({
  url: createUrl,
  send,
  chunkSize: 10,
  retryDelays: [0, 0, 0],
  sleep: () => Promise.resolve(),
});

describe("createTusUpload", () => {
  test("creates the upload with its length then sends the file in chunks", async () => {
    const progress: number[] = [];
    const { calls, send } = harness([
      () => Promise.resolve(created()),
      () => Promise.resolve(patched(10)),
      () => Promise.resolve(patched(20)),
      () => Promise.resolve(patched(25)),
    ]);
    const upload = createTusUpload(file(25), {
      ...options(send),
      onProgress: (offset, total) => progress.push(Math.round((offset / total) * 100)),
    });
    expect(await upload.start()).toBe("completed");
    expect(
      calls.map(({ method, offset, length, bytes }) => ({ method, offset, length, bytes })),
    ).toEqual([
      { method: "POST", offset: null, length: "25", bytes: null },
      { method: "PATCH", offset: "0", length: null, bytes: 10 },
      { method: "PATCH", offset: "10", length: null, bytes: 10 },
      { method: "PATCH", offset: "20", length: null, bytes: 5 },
    ]);
    expect(calls[1]?.url).toBe(location);
    expect(progress).toEqual([40, 80, 100]);
  });

  test("when the network drops it asks the server for the offset and continues from there", async () => {
    const { calls, send } = harness([
      () => Promise.resolve(created()),
      () => Promise.resolve(patched(10)),
      () => Promise.reject(new TypeError("network down")),
      () => Promise.resolve(offsetOf(14)),
      () => Promise.resolve(patched(25)),
    ]);
    const upload = createTusUpload(file(25), options(send));
    expect(await upload.start()).toBe("completed");
    expect(calls.map(({ method, offset }) => `${method}:${offset}`)).toEqual([
      "POST:null",
      "PATCH:0",
      "PATCH:10",
      "HEAD:null",
      "PATCH:14",
    ]);
  });

  test("pause stops the request in flight and resume continues from the server offset", async () => {
    const { calls, send } = harness([
      () => Promise.resolve(created()),
      (_call, signal) =>
        new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
      () => Promise.resolve(offsetOf(6)),
      () => Promise.resolve(patched(16)),
      () => Promise.resolve(patched(20)),
    ]);
    const states: string[] = [];
    const upload = createTusUpload(file(20), {
      ...options(send),
      onStateChange: (state) => states.push(state),
    });
    const finished = upload.start();
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    upload.pause();
    await vi.waitFor(() => expect(states).toContain("paused"));
    expect(calls).toHaveLength(2);
    upload.resume();
    expect(await finished).toBe("completed");
    expect(calls.map(({ method, offset }) => `${method}:${offset}`)).toEqual([
      "POST:null",
      "PATCH:0",
      "HEAD:null",
      "PATCH:6",
      "PATCH:16",
    ]);
  });

  test("cancel ends the upload without an error", async () => {
    const { send } = harness([
      () => Promise.resolve(created()),
      (_call, signal) =>
        new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    ]);
    const upload = createTusUpload(file(20), options(send));
    const finished = upload.start();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    upload.cancel();
    expect(await finished).toBe("cancelled");
  });

  test("a refusal from the server fails at once with its error code and is not retried", async () => {
    const { calls, send } = harness([
      () => Promise.resolve(created()),
      () => Promise.resolve(failure(415, "UPLOAD_TYPE_NOT_ALLOWED")),
    ]);
    const upload = createTusUpload(file(20), options(send));
    const error = await upload.start().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(TusUploadError);
    expect(error).toMatchObject({ status: 415, code: "UPLOAD_TYPE_NOT_ALLOWED" });
    expect(calls).toHaveLength(2);
  });

  test("a locked course on creation fails with the content lock code", async () => {
    const { send } = harness([() => Promise.resolve(failure(409, "CONTENT_LOCKED"))]);
    const error = await createTusUpload(file(20), options(send))
      .start()
      .catch((reason: unknown) => reason);
    expect(error).toMatchObject({ status: 409, code: "CONTENT_LOCKED" });
  });

  test("gives up after the retry delays are used and reports a network failure", async () => {
    const { calls, send } = harness([
      () => Promise.resolve(created()),
      () => Promise.reject(new TypeError("down")),
      () => Promise.reject(new TypeError("down")),
      () => Promise.reject(new TypeError("down")),
      () => Promise.reject(new TypeError("down")),
      () => Promise.reject(new TypeError("down")),
      () => Promise.reject(new TypeError("down")),
      () => Promise.reject(new TypeError("down")),
    ]);
    const error = await createTusUpload(file(20), options(send))
      .start()
      .catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });
    expect(calls.length).toBeGreaterThan(3);
  });

  test("an offset conflict is resolved by asking the server again", async () => {
    const { calls, send } = harness([
      () => Promise.resolve(created()),
      () => Promise.resolve(failure(409, "UPLOAD_OFFSET_MISMATCH")),
      () => Promise.resolve(offsetOf(10)),
      () => Promise.resolve(patched(20)),
    ]);
    expect(await createTusUpload(file(20), options(send)).start()).toBe("completed");
    expect(calls.map(({ method, offset }) => `${method}:${offset}`)).toEqual([
      "POST:null",
      "PATCH:0",
      "HEAD:null",
      "PATCH:10",
    ]);
  });
});
