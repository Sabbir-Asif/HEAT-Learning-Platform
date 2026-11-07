import { randomUUID } from "node:crypto";
import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";
import { z } from "zod";
import type { ErrorCode, ErrorResponse, FieldError } from "@heat/contracts";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}
interface ResponseLike {
  headersSent?: boolean;
  writableEnded?: boolean;
  end(): unknown;
  setHeader(name: string, value: string): unknown;
  status(code: number): { json(body: unknown): unknown };
}

const messages: Record<ErrorCode, string> = {
  BAD_REQUEST: "The request could not be processed.",
  FORBIDDEN: "You are not allowed to do this.",
  INTERNAL: "Something went wrong on the server.",
  NOT_FOUND: "The requested resource was not found.",
  RATE_LIMITED: "Too many requests. Try again later.",
  UNAUTHENTICATED: "Sign in to continue.",
  VALIDATION_FAILED: "Some fields are not valid.",
};

const issuesSchema = z.object({
  issues: z.array(
    z.object({ path: z.array(z.union([z.string(), z.number(), z.symbol()])), code: z.string() }),
  ),
});

const requestIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

function resolveRequestId(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value !== undefined && requestIdPattern.test(value) ? value : randomUUID();
}

function codeForStatus(status: number): ErrorCode {
  if (status >= 500) return "INTERNAL";
  switch (status) {
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 429:
      return "RATE_LIMITED";
    default:
      return "BAD_REQUEST";
  }
}

function fieldErrors(error: unknown): FieldError[] {
  const parsed = issuesSchema.safeParse(error);
  if (!parsed.success) return [];
  return parsed.data.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
  }));
}

function middlewareStatus(exception: unknown): number | undefined {
  if (typeof exception !== "object" || exception === null) return undefined;
  const status = (exception as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 600 ? status : undefined;
}

interface Classified {
  status: number;
  code: ErrorCode;
  fields?: FieldError[];
}

function classify(exception: unknown): Classified {
  if (exception instanceof ZodValidationException) {
    return { status: 400, code: "VALIDATION_FAILED", fields: fieldErrors(exception.getZodError()) };
  }
  const status =
    exception instanceof HttpException ? exception.getStatus() : middlewareStatus(exception);
  if (status === undefined) return { status: 500, code: "INTERNAL" };
  return { status, code: codeForStatus(status) };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();
    const requestId = resolveRequestId(request.headers["x-request-id"]);
    const { status, code, fields } = classify(exception);

    const name = exception instanceof Error ? exception.name : typeof exception;

    if (response.headersSent) {
      this.logger.error(`${name} (request ${requestId})`);
      if (!response.writableEnded) response.end();
      return;
    }

    if (status >= 500) {
      this.logger.error(`${name} (request ${requestId})`);
    }

    const body: ErrorResponse = {
      error: { code, message: messages[code], requestId, ...(fields ? { fields } : {}) },
    };
    response.setHeader("x-request-id", requestId);
    response.status(status).json(body);
  }
}
