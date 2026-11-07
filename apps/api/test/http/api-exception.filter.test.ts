import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@heat/contracts";
import type { ErrorResponse } from "@heat/contracts";
import type { ArgumentsHost } from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { configureApp } from "../../src/app.setup";
import { ApiExceptionFilter } from "../../src/http/api-exception.filter";
import { HttpApiModule } from "../../src/http/http.module";
import { ItemsController } from "../openapi/fixtures";

@Controller("fail")
class FailController {
  @Get("unauthorized")
  unauthorized() {
    throw new UnauthorizedException("token abc is expired for ada@example.com");
  }
  @Get("forbidden")
  forbidden() {
    throw new ForbiddenException();
  }
  @Get("missing")
  missing() {
    throw new NotFoundException("no such learner ada@example.com");
  }
  @Get("limited")
  limited() {
    throw new HttpException("slow down", 429);
  }
  @Get("conflict")
  conflict() {
    throw new HttpException("conflict", 409);
  }
  @Get("unavailable")
  unavailable() {
    throw new HttpException("maintenance", 503);
  }
  @Get("boom")
  boom() {
    throw new Error("connection to db.internal:5432 refused for user heat");
  }
}

let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [HttpApiModule],
    controllers: [FailController, ItemsController],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0);
  baseUrl = await app.getUrl();
});
afterAll(() => app.close());

async function call(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return { response, text, body: JSON.parse(text) as ErrorResponse };
}

const post = (body: string) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body,
});

describe("validation", () => {
  test("a Zod failure on the body is VALIDATION_FAILED with a path per field", async () => {
    const { response, body } = await call(
      "/api/items",
      post(JSON.stringify({ name: "a", quantity: 0 })),
    );
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(body).error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fields).toEqual(
      expect.arrayContaining([
        { path: "name", code: "too_small" },
        { path: "quantity", code: "too_small" },
      ]),
    );
  });

  test("a Zod failure on the query is reported with the query key as the path", async () => {
    const { response, body } = await call("/api/items?page=0");
    expect(response.status).toBe(400);
    expect(body.error.fields).toEqual([{ path: "page", code: "too_small" }]);
  });

  test("a Zod failure on a path parameter is VALIDATION_FAILED", async () => {
    const { response, body } = await call("/api/items/not-a-uuid");
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fields?.[0]?.path).toBe("id");
  });

  test("a valid request is not touched", async () => {
    const response = await fetch(`${baseUrl}/api/items?page=2`);
    expect(await response.json()).toEqual({ page: 2 });
  });

  test("malformed JSON is BAD_REQUEST, not an internal error", async () => {
    const { response, body } = await call("/api/items", post("{not json"));
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});

describe("HTTP exceptions", () => {
  test.each([
    ["/api/fail/unauthorized", 401, "UNAUTHENTICATED"],
    ["/api/fail/forbidden", 403, "FORBIDDEN"],
    ["/api/fail/missing", 404, "NOT_FOUND"],
    ["/api/nowhere", 404, "NOT_FOUND"],
    ["/api/fail/limited", 429, "RATE_LIMITED"],
    ["/api/fail/conflict", 409, "BAD_REQUEST"],
    ["/api/fail/unavailable", 503, "INTERNAL"],
  ])("%s gives %i and %s", async (path, status, code) => {
    const { response, body } = await call(path);
    expect(response.status).toBe(status);
    expect(errorResponseSchema.parse(body).error.code).toBe(code);
  });

  test("the message is fixed text, never the exception text", async () => {
    const { text } = await call("/api/fail/missing");
    expect(text).not.toContain("ada@example.com");
    expect(text).not.toContain("learner");
  });
});

describe("unknown errors", () => {
  test("give 500 INTERNAL with no message, stack or host detail", async () => {
    const { response, body, text } = await call("/api/fail/boom");
    expect(response.status).toBe(500);
    expect(errorResponseSchema.parse(body).error.code).toBe("INTERNAL");
    expect(text).not.toContain("db.internal");
    expect(text).not.toMatch(/at .*\.ts|\.js:\d+/);
  });
});

describe("request id", () => {
  test("a valid x-request-id is echoed in the header and the body", async () => {
    const { response, body } = await call("/api/fail/forbidden", {
      headers: { "x-request-id": "req-1234.abc" },
    });
    expect(response.headers.get("x-request-id")).toBe("req-1234.abc");
    expect(body.error.requestId).toBe("req-1234.abc");
  });

  test("a missing id is generated", async () => {
    const { response, body } = await call("/api/fail/forbidden");
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  test("an id with unsafe characters is replaced, so it cannot inject into logs", async () => {
    const { body } = await call("/api/fail/forbidden", {
      headers: { "x-request-id": "bad id\twith spaces <script>" },
    });
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("the filter on its own", () => {
  function run(exception: unknown, headers: Record<string, string | string[] | undefined> = {}) {
    const sent: { status?: number; body?: ErrorResponse; headers: Record<string, string> } = {
      headers: {},
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
        getResponse: () => ({
          setHeader: (name: string, value: string) => {
            sent.headers[name] = value;
          },
          status: (code: number) => {
            sent.status = code;
            return { json: (body: ErrorResponse) => (sent.body = body) };
          },
        }),
      }),
    } as unknown as ArgumentsHost;
    new ApiExceptionFilter().catch(exception, host);
    return sent;
  }

  test("uses the first value of a repeated x-request-id header", () => {
    expect(
      run(new NotFoundException(), { "x-request-id": ["first-id", "second-id"] }).body?.error
        .requestId,
    ).toBe("first-id");
  });

  test("a thrown string is an internal error", () => {
    const sent = run("boom");
    expect(sent.status).toBe(500);
    expect(sent.body?.error.code).toBe("INTERNAL");
  });

  test("an Express middleware error with a 4xx status keeps that status", () => {
    const sent = run(Object.assign(new Error("request entity too large"), { status: 413 }));
    expect(sent.status).toBe(413);
    expect(sent.body?.error.code).toBe("BAD_REQUEST");
  });

  test("an object with a non-numeric status is an internal error", () => {
    expect(run({ status: "teapot" }).status).toBe(500);
    expect(run(null).status).toBe(500);
  });

  test("a validation exception whose payload is not a Zod error has no fields", () => {
    const sent = run(new ZodValidationException("not a zod error"));
    expect(sent.status).toBe(400);
    expect(sent.body?.error.fields).toEqual([]);
  });
});
