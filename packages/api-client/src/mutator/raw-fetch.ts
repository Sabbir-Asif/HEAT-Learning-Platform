import { abortedError, isApiError, networkError, parseErrorResponse } from "../errors";
import { toApiPath } from "../transport";
import { applyInterceptors, getUnauthorizedHandler } from "./extensions";

const isAbort = (error: unknown, signal: AbortSignal | null | undefined): boolean =>
  signal?.aborted === true ||
  (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError");

async function send(url: string, init: RequestInit): Promise<Response> {
  const request = await applyInterceptors({
    url: toApiPath(url),
    init: { ...init, credentials: "include" },
  });
  try {
    return await fetch(request.url, request.init);
  } catch (cause) {
    throw isAbort(cause, init.signal) ? abortedError() : networkError();
  }
}

export async function fetchResponse(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await send(url, init);
  const handler = getUnauthorizedHandler();
  if (response.status !== 401 || handler === undefined) return response;
  const error = await parseErrorResponse(response.clone());
  if (isApiError(error) && (await handler(error, { url: toApiPath(url) }))) {
    return send(url, init);
  }
  return response;
}
