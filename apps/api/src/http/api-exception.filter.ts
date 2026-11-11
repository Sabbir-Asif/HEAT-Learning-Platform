import { randomUUID } from "node:crypto";
import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";
import { ApiException } from "./api-exception";
import { z } from "zod";
import { fieldErrorCodes } from "@heat/contracts";
import type { ErrorCode, ErrorResponse, FieldError, FieldErrorCode } from "@heat/contracts";

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
  AUDIT_ACTOR_FILTER_TOO_BROAD:
    "Too many accounts match this actor filter. Enter more of the email address.",
  BAD_REQUEST: "The request could not be processed.",
  CANNOT_DEACTIVATE_SELF: "You cannot deactivate your own account.",
  CAPTCHA_EXPIRED: "This security check can no longer be used. Request a new one.",
  CAPTCHA_INVALID: "The characters do not match. Try again.",
  CONTENT_LOCKED:
    "This course is locked. Its modules and sections cannot be added, removed or reordered.",
  COURSE_HAS_ENROLLMENTS: "This course has enrollments, so it cannot be deleted.",
  COURSE_LOCKED: "This course is locked. Only the description and thumbnail can be changed.",
  COURSE_NOT_AVAILABLE: "This course is not open for enrollment.",
  COURSE_NOT_DRAFT: "This action is only available for a draft course.",
  COURSE_PUBLISH_CHECKS_FAILED: "The course is not ready to publish.",
  COURSE_SLUG_TAKEN: "A course with this slug already exists.",
  CSRF_TOKEN_INVALID:
    "The security token for this request is missing or no longer valid. Reload the page and try again.",
  DIRECTORY_ARCHIVED:
    "This record is archived, so it cannot be used for new records. Restore it first.",
  DIRECTORY_IN_USE: "This record is still in use, so it cannot be deleted.",
  DIRECTORY_NAME_TAKEN: "A record with this name already exists.",
  EMAIL_IN_USE: "An account with this email address already exists.",
  ENROLLMENT_ALREADY_DECIDED: "This request was already decided or was withdrawn.",
  ENROLLMENT_NOT_ACTIVE: "Your enrollment in this course is not active.",
  ENROLLMENT_NOT_VERIFIED: "The student has not verified their email yet, so it cannot be approved.",
  FORBIDDEN: "You are not allowed to do this.",
  INTERNAL: "Something went wrong on the server.",
  INVALID_CREDENTIALS: "The email or password is not correct.",
  INVITATION_EXPIRED: "This invitation has expired. Ask the super admin to send a new one.",
  INVITATION_INVALID: "This invitation link is not valid.",
  INVITATION_NOT_PENDING: "This admin has no pending invitation.",
  NOT_FOUND: "The requested resource was not found.",
  ORDER_CONFLICT: "The order was changed by someone else. Reload and try again.",
  ORIGIN_NOT_ALLOWED: "This request did not come from an allowed site.",
  PASSWORD_BREACHED: "This password has appeared in a data breach. Choose a different one.",
  PASSWORD_CHANGE_REQUIRED: "Change your password to continue.",
  RATE_LIMITED: "Too many requests. Try again later.",
  UNAUTHENTICATED: "Sign in to continue.",
  VALIDATION_FAILED: "Some fields are not valid.",
  VERIFICATION_LINK_EXPIRED: "This verification link has expired. Request a new one.",
  VERIFICATION_LINK_INVALID: "This verification link is not valid.",
  VERIFICATION_LINK_USED: "This verification link has already been used or replaced.",
  VERIFICATION_RESEND_LIMIT: "Too many verification emails were requested for this registration.",
};

const issuesSchema = z.object({
  issues: z.array(
    z.object({
      path: z.array(z.union([z.string(), z.number(), z.symbol()])),
      code: z.string(),
      message: z.string().optional(),
    }),
  ),
});

type Issue = z.infer<typeof issuesSchema>["issues"][number];

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

const isFieldErrorCode = (code: string): code is FieldErrorCode =>
  (fieldErrorCodes as readonly string[]).includes(code);

const isMissingValue = (issue: Issue) => issue.message?.endsWith("received undefined") === true;

function fieldErrorCode(issue: Issue): FieldErrorCode {
  if (issue.code === "invalid_type" && isMissingValue(issue)) return "required";
  return isFieldErrorCode(issue.code) ? issue.code : "invalid";
}

function fieldErrors(error: unknown): FieldError[] {
  const parsed = issuesSchema.safeParse(error);
  if (!parsed.success) return [];
  return parsed.data.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: fieldErrorCode(issue),
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
  retryAfterSeconds?: number;
  detail?: string;
  failures?: string[];
}

function classify(exception: unknown): Classified {
  if (exception instanceof ZodValidationException) {
    return { status: 400, code: "VALIDATION_FAILED", fields: fieldErrors(exception.getZodError()) };
  }
  if (exception instanceof ApiException) {
    return {
      status: exception.getStatus(),
      code: exception.code,
      retryAfterSeconds: exception.retryAfterSeconds,
      detail: exception.detail,
      fields: exception.fields,
      failures: exception.failures,
    };
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
    const { status, code, fields, failures, retryAfterSeconds, detail } = classify(exception);

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
      error: {
        code,
        message: detail ?? messages[code],
        requestId,
        ...(fields ? { fields } : {}),
        ...(failures ? { failures } : {}),
      },
    };
    response.setHeader("x-request-id", requestId);
    if (retryAfterSeconds !== undefined) {
      response.setHeader("retry-after", String(retryAfterSeconds));
    }
    response.status(status).json(body);
  }
}
