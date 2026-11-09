import type { ApiError } from "../errors";

export interface ApiRequest {
  url: string;
  init: RequestInit;
}

export type RequestInterceptor = (request: ApiRequest) => ApiRequest | Promise<ApiRequest>;

export interface UnauthorizedContext {
  url: string;
}

export type UnauthorizedHandler = (
  error: ApiError,
  context: UnauthorizedContext,
) => boolean | Promise<boolean>;

const interceptors: RequestInterceptor[] = [];
let unauthorizedHandler: UnauthorizedHandler | undefined;

export function registerRequestInterceptor(interceptor: RequestInterceptor): () => void {
  interceptors.push(interceptor);
  return () => {
    const index = interceptors.indexOf(interceptor);
    if (index !== -1) interceptors.splice(index, 1);
  };
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler;
}

export async function applyInterceptors(request: ApiRequest): Promise<ApiRequest> {
  let current = request;
  for (const interceptor of [...interceptors]) current = await interceptor(current);
  return current;
}

export const getUnauthorizedHandler = () => unauthorizedHandler;
