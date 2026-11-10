import { HttpException } from "@nestjs/common";
import type { ErrorCode } from "@heat/contracts";

export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    readonly retryAfterSeconds?: number,
    readonly detail?: string,
  ) {
    super(code, status);
  }
}
