export const packageName = "@heat/api-client";

export { ApiError, isApiError } from "./errors";
export type { ApiErrorCode } from "./errors";
export { registerRequestInterceptor, setUnauthorizedHandler } from "./mutator/extensions";
export type { ApiRequest, RequestInterceptor, UnauthorizedHandler } from "./mutator/extensions";

export * from "./generated/client/endpoints";
export * from "./generated/client/model";
