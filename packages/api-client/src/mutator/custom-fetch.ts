import {
  abortedError,
  ApiError,
  isApiError,
  networkError,
  parseErrorResponse,
  unexpectedResponseError,
} from "../errors";
import { applyInterceptors, getUnauthorizedHandler } from "./extensions";

/** Error type orval puts on every generated hook. Orval passes a type argument, which an ApiError does not need. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ErrorType<_Error> = ApiError;

const PREFIX = "/api";

/** The generated paths already start with `/api`; a path without it gets it, once. */
function toApiPath(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//")) {
    throw new TypeError("The API client only sends same-origin paths such as /api/health.");
  }
  return url === PREFIX || url.startsWith(`${PREFIX}/`) || url.startsWith(`${PREFIX}?`)
    ? url
    : `${PREFIX}${url}`;
}

function prepare(options: RequestInit): RequestInit {
  const headers = new Headers(options.headers);
  // The browser sets the multipart boundary itself; a bodiless request has no content type.
  if (options.body === undefined || options.body === null || options.body instanceof FormData) {
    headers.delete("content-type");
  }
  return { ...options, headers, credentials: "include" };
}

// By name rather than `instanceof`: a DOMException from another realm (jsdom, an iframe) is not an Error here.
const isAbort = (error: unknown, signal: AbortSignal | null | undefined) =>
  signal?.aborted === true ||
  (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError");

async function send<T>(url: string, options: RequestInit): Promise<T> {
  const { url: finalUrl, init } = await applyInterceptors({
    url: toApiPath(url),
    init: prepare(options),
  });
  const failure = (cause: unknown) =>
    isAbort(cause, init.signal) ? abortedError() : networkError();

  let response: Response;
  try {
    response = await fetch(finalUrl, init);
  } catch (cause) {
    throw failure(cause);
  }
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

/**
 * The fetch mutator behind every generated hook (see `orval.config.ts`). Same-origin `/api`,
 * cookies included. Failures are thrown as `ApiError`. A 401 goes to the handler registered with
 * `setUnauthorizedHandler`, which can ask for one retry.
 */
export async function customFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    return await send<T>(url, options);
  } catch (error) {
    const handler = getUnauthorizedHandler();
    if (isApiError(error) && error.status === 401 && handler && (await handler(error))) {
      return send<T>(url, options);
    }
    throw error;
  }
}
