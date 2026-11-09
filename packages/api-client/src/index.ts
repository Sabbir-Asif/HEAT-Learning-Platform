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
export { createSessionRefresh, installSessionRefresh } from "./mutator/session-refresh";
export type { SessionRefreshOptions } from "./mutator/session-refresh";

export * from "./generated/client/endpoints";
export * from "./generated/client/model";
