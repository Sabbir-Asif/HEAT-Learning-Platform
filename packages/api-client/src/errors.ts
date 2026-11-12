import { errorResponseSchema } from "@heat/contracts";
import type { ClientErrorCode, ErrorCode, ErrorDetails, FieldError } from "@heat/contracts";

export type ApiErrorCode = ErrorCode | ClientErrorCode;

export interface ApiErrorInit {
  status: number;
  code: ApiErrorCode;
  fields?: readonly FieldError[];
  failures?: readonly string[];
  requestId?: string;
  retryAfterSeconds?: number;
  details?: ErrorDetails;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: readonly FieldError[];
  readonly failures: readonly string[];
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly details?: ErrorDetails;

  constructor(init: ApiErrorInit) {
    super(init.code);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields ?? [];
    this.failures = init.failures ?? [];
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.details = init.details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export const networkError = () => new ApiError({ status: 0, code: "NETWORK_ERROR" });

export const abortedError = () => new ApiError({ status: 0, code: "REQUEST_ABORTED" });

export const unexpectedResponseError = (status: number) =>
  new ApiError({ status, code: "UNEXPECTED_RESPONSE" });

function retryAfterSeconds(header: string | null): number | undefined {
  if (header === null) return undefined;
  if (/^\d+$/.test(header.trim())) return Number(header);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

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
  const { code, fields, failures, requestId, details } = envelope.data.error;
  return new ApiError({
    status: response.status,
    code,
    fields,
    failures,
    requestId,
    details,
    retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")),
  });
}
