import { abortedError, networkError, parseErrorResponse, unexpectedResponseError } from "./errors";

const PREFIX = "/api";

export function toApiPath(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) {
    throw new TypeError("The API client only sends paths such as /api/health.");
  }
  return url === PREFIX || url.startsWith(`${PREFIX}/`) || url.startsWith(`${PREFIX}?`)
    ? url
    : `${PREFIX}${url}`;
}

const isAbort = (error: unknown, signal: AbortSignal | null | undefined) =>
  signal?.aborted === true ||
  (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError");

export async function execute<T>(url: string, init: RequestInit): Promise<T> {
  const failure = (cause: unknown) =>
    isAbort(cause, init.signal) ? abortedError() : networkError();

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw failure(cause);
  }
  if (response.status >= 300 && response.status < 400)
    throw unexpectedResponseError(response.status);
  if (!response.ok) throw await parseErrorResponse(response);

  let text: string;
  try {
    text = await response.text();
  } catch (cause) {
    throw failure(cause);
  }
  if (text === "") return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw unexpectedResponseError(response.status);
  }
}
