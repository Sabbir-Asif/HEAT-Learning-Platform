import { errorResponseSchema } from "@heat/contracts";
import type { ClientErrorCode, ErrorCode, FieldError } from "@heat/contracts";

export type ApiErrorCode = ErrorCode | ClientErrorCode;

export interface ApiErrorInit {
  status: number;
  code: ApiErrorCode;
  fields?: readonly FieldError[];
  requestId?: string;
  retryAfterSeconds?: number;
}

/**
 * Every failed API call ends as this error, from the browser mutator and the server fetcher alike.
 * `message` is the code, never text from the server: screens show their own translated message
 * for `code` (see `@heat/contracts`).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: readonly FieldError[];
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(init: ApiErrorInit) {
    super(init.code);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields ?? [];
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** The request never produced a response (offline, DNS, connection reset). */
export const networkError = () => new ApiError({ status: 0, code: "NETWORK_ERROR" });

/** The caller aborted the request. */
export const abortedError = () => new ApiError({ status: 0, code: "REQUEST_ABORTED" });

/** A response arrived but is not something the API sends. */
export const unexpectedResponseError = (status: number) =>
  new ApiError({ status, code: "UNEXPECTED_RESPONSE" });

/** Seconds from a `Retry-After` header, given as a number of seconds or an HTTP date. */
function retryAfterSeconds(header: string | null): number | undefined {
  if (header === null) return undefined;
  if (/^\d+$/.test(header.trim())) return Number(header);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/**
 * Reads the body of a failed response. An API envelope becomes an `ApiError` with its code; anything
 * else (a proxy's HTML page, an empty body, a code this client does not know) becomes
 * `UNEXPECTED_RESPONSE` with the status kept and nothing from the body.
 */
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return unexpectedResponseError(response.status);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return unexpectedResponseError(response.status);
  }
  const envelope = errorResponseSchema.safeParse(json);
  if (!envelope.success) return unexpectedResponseError(response.status);
  const { code, fields, requestId } = envelope.data.error;
  return new ApiError({
    status: response.status,
    code,
    fields,
    requestId,
    retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")),
  });
}
