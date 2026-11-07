import { ApiError, isApiError } from "../errors";
import { execute, toApiPath } from "../transport";
import { applyInterceptors, getUnauthorizedHandler } from "./extensions";

/** Error type orval puts on every generated hook. Orval passes a type argument, which an ApiError does not need. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ErrorType<_Error> = ApiError;

function prepare(options: RequestInit): RequestInit {
  const headers = new Headers(options.headers);
  // The browser sets the multipart boundary itself; a bodiless request has no content type.
  if (options.body === undefined || options.body === null || options.body instanceof FormData) {
    headers.delete("content-type");
  }
  return { ...options, headers, credentials: "include" };
}

async function send<T>(url: string, options: RequestInit): Promise<T> {
  const request = await applyInterceptors({ url: toApiPath(url), init: prepare(options) });
  return execute<T>(request.url, request.init);
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
