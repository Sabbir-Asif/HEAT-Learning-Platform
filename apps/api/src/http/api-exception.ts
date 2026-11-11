import { HttpException } from "@nestjs/common";
import type { ErrorCode, ErrorDetails, FieldError } from "@heat/contracts";

export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    readonly retryAfterSeconds?: number,
    readonly detail?: string,
    readonly fields?: FieldError[],
    readonly failures?: string[],
    readonly details?: ErrorDetails,
  ) {
    super(code, status);
  }
}
