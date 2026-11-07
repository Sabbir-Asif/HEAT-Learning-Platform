import type { ApiError } from "../errors";

export interface ApiRequest {
  url: string;
  init: RequestInit;
}

/** Runs before every request, in registration order, and returns the request to send (CSRF header, E3-7). */
export type RequestInterceptor = (request: ApiRequest) => ApiRequest | Promise<ApiRequest>;

/** Called on a 401. Resolve `true` after refreshing the session to retry the request once (E3-2). */
export type UnauthorizedHandler = (error: ApiError) => boolean | Promise<boolean>;

const interceptors: RequestInterceptor[] = [];
let unauthorizedHandler: UnauthorizedHandler | undefined;

/** Returns a function that removes the interceptor again. */
export function registerRequestInterceptor(interceptor: RequestInterceptor): () => void {
  interceptors.push(interceptor);
  return () => {
    const index = interceptors.indexOf(interceptor);
    if (index !== -1) interceptors.splice(index, 1);
  };
}

/** One handler at most; pass `undefined` to remove it. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler;
}

export async function applyInterceptors(request: ApiRequest): Promise<ApiRequest> {
  let current = request;
  for (const interceptor of [...interceptors]) current = await interceptor(current);
  return current;
}

export const getUnauthorizedHandler = () => unauthorizedHandler;
