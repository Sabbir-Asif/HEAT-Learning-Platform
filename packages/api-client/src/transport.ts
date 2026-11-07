import { abortedError, networkError, parseErrorResponse, unexpectedResponseError } from "./errors";

const PREFIX = "/api";

/**
 * The generated paths already start with `/api`; a path without it gets it, once. Anything that is
 * not a plain path is refused, so the client cannot be pointed at another origin.
 */
export function toApiPath(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) {
    throw new TypeError("The API client only sends paths such as /api/health.");
  }
  return url === PREFIX || url.startsWith(`${PREFIX}/`) || url.startsWith(`${PREFIX}?`)
    ? url
    : `${PREFIX}${url}`;
}

// By name rather than `instanceof`: a DOMException from another realm (jsdom, an iframe) is not an Error here.
const isAbort = (error: unknown, signal: AbortSignal | null | undefined) =>
  signal?.aborted === true ||
  (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError");

/**
 * Sends the request and returns the parsed JSON body (`undefined` for an empty one). Every failure
 * is thrown as an `ApiError`: an API envelope keeps its code, anything else gets a fallback code and
 * never carries the response body or a raw error. A redirect is never followed or trusted.
 */
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
