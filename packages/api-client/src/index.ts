export const packageName = "@heat/api-client";

export { ApiError, isApiError } from "./errors";
export type { ApiErrorCode } from "./errors";
export { registerRequestInterceptor, setUnauthorizedHandler } from "./mutator/extensions";
export type {
  ApiRequest,
  RequestInterceptor,
  UnauthorizedContext,
  UnauthorizedHandler,
} from "./mutator/extensions";
export { fetchResponse } from "./mutator/raw-fetch";
export { createCsrfInterceptor, installCsrf, readDocumentCookie } from "./mutator/csrf";
export type { CsrfOptions } from "./mutator/csrf";
export { createSessionRefresh, installSessionRefresh } from "./mutator/session-refresh";
export type { SessionRefreshOptions } from "./mutator/session-refresh";

export * from "./generated/client/endpoints";
export * from "./generated/client/model";
