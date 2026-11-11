import { tusProtocol } from "@heat/contracts";

export type TusSend = (url: string, init?: RequestInit) => Promise<Response>;

export type TusState = "uploading" | "paused";

export type TusOutcome = "completed" | "cancelled";

export interface TusUploadOptions {
  url: string;
  send: TusSend;
  chunkSize?: number;
  retryDelays?: readonly number[];
  sleep?: (milliseconds: number) => Promise<void>;
  onProgress?: (offset: number, total: number) => void;
  onStateChange?: (state: TusState) => void;
}

export interface TusUpload {
  start(): Promise<TusOutcome>;
  pause(): void;
  resume(): void;
  cancel(): void;
}

export class TusUploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "TusUploadError";
  }
}

const defaultChunkSize = 4 * 1024 * 1024;
const defaultRetryDelays = [1000, 2000, 4000, 8000, 15000, 30000];
const retryableStatuses: ReadonlySet<number> = new Set([409, 423, 429, 500, 502, 503, 504]);

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isAbort = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";

const codeOf = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

const isNetworkFailure = (error: unknown): boolean =>
  !(error instanceof TusUploadError) && !isAbort(error) && codeOf(error) !== "REQUEST_ABORTED";

const wasAborted = (error: unknown): boolean =>
  isAbort(error) || codeOf(error) === "REQUEST_ABORTED";

const failureOf = async (response: Response): Promise<TusUploadError> => {
  let code = "UNEXPECTED_RESPONSE";
  try {
    const body: unknown = await response.json();
    const error = typeof body === "object" && body !== null && "error" in body ? body.error : null;
    code = codeOf(error) ?? code;
  } catch {
    code = "UNEXPECTED_RESPONSE";
  }
  return new TusUploadError(response.status, code);
};

const offsetHeader = (response: Response): number => {
  const value = Number(response.headers.get("Upload-Offset"));
  if (!Number.isInteger(value) || value < 0) {
    throw new TusUploadError(response.status, "UNEXPECTED_RESPONSE");
  }
  return value;
};

export function createTusUpload(file: Blob, options: TusUploadOptions): TusUpload {
  const chunkSize = options.chunkSize ?? defaultChunkSize;
  const retryDelays = options.retryDelays ?? defaultRetryDelays;
  const sleep = options.sleep ?? wait;
  let location: string | null = null;
  let offset = 0;
  let needsSync = false;
  let paused = false;
  let cancelled = false;
  let controller: AbortController | null = null;
  let wake: (() => void) | null = null;

  const headers = (extra: Record<string, string>): Record<string, string> => ({
    "Tus-Resumable": tusProtocol.version,
    ...extra,
  });

  const create = async (): Promise<string> => {
    const response = await options.send(options.url, {
      method: "POST",
      headers: headers({ "Upload-Length": String(file.size) }),
    });
    const next = response.headers.get("Location");
    if (response.status !== 201 || next === null) throw await failureOf(response);
    return next;
  };

  const sync = async (target: string): Promise<void> => {
    const response = await options.send(target, { method: "HEAD", headers: headers({}) });
    if (!response.ok) throw await failureOf(response);
    offset = offsetHeader(response);
    needsSync = false;
  };

  const sendChunk = async (target: string): Promise<void> => {
    controller = new AbortController();
    const response = await options.send(target, {
      method: "PATCH",
      headers: headers({
        "Content-Type": tusProtocol.offsetContentType,
        "Upload-Offset": String(offset),
      }),
      body: file.slice(offset, Math.min(offset + chunkSize, file.size)),
      signal: controller.signal,
    });
    if (response.status !== 204) {
      needsSync = true;
      throw await failureOf(response);
    }
    offset = offsetHeader(response);
    options.onProgress?.(offset, file.size);
  };

  const park = (): Promise<void> =>
    new Promise((resolve) => {
      wake = resolve;
    });

  const isRetryable = (error: unknown): boolean =>
    isNetworkFailure(error) ||
    (error instanceof TusUploadError && retryableStatuses.has(error.status));

  const run = async (): Promise<TusOutcome> => {
    location ??= await create();
    let attempt = 0;
    while (!cancelled) {
      if (paused) {
        options.onStateChange?.("paused");
        await park();
        options.onStateChange?.("uploading");
        continue;
      }
      try {
        if (needsSync) await sync(location);
        if (offset >= file.size) return "completed";
        await sendChunk(location);
        attempt = 0;
      } catch (error) {
        needsSync = true;
        if (paused || cancelled || wasAborted(error)) continue;
        const delay = retryDelays[attempt];
        if (!isRetryable(error) || delay === undefined) {
          throw isNetworkFailure(error) ? new TusUploadError(0, "NETWORK_ERROR") : error;
        }
        attempt += 1;
        await sleep(delay);
      }
    }
    return "cancelled";
  };

  return {
    start: run,
    pause() {
      if (paused || cancelled) return;
      paused = true;
      controller?.abort();
    },
    resume() {
      if (!paused) return;
      paused = false;
      wake?.();
      wake = null;
    },
    cancel() {
      cancelled = true;
      controller?.abort();
      wake?.();
      wake = null;
    },
  };
}
