import { ApiError, isApiError } from "../errors";
import { execute, toApiPath } from "../transport";
import { applyInterceptors, getUnauthorizedHandler } from "./extensions";

export type ErrorType<TError = unknown> = TError extends ApiError ? TError : ApiError;

function prepare(options: RequestInit): RequestInit {
  const headers = new Headers(options.headers);
  if (options.body === undefined || options.body === null || options.body instanceof FormData) {
    headers.delete("content-type");
  }
  return { ...options, headers, credentials: "include" };
}

async function send<T>(url: string, options: RequestInit): Promise<T> {
  const request = await applyInterceptors({ url: toApiPath(url), init: prepare(options) });
  return execute<T>(request.url, request.init);
}

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
