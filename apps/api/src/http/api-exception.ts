import { HttpException } from "@nestjs/common";
import type { ErrorCode, FieldError } from "@heat/contracts";

export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    readonly retryAfterSeconds?: number,
    readonly detail?: string,
    readonly fields?: FieldError[],
  ) {
    super(code, status);
  }
}
