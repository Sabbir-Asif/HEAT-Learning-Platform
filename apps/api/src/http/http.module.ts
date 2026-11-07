import { Module } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { ApiExceptionFilter } from "./api-exception.filter";

/** HTTP-only behaviour: Zod validation of every DTO and the shared error envelope. Not part of `core`, the worker has no HTTP. */
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class HttpApiModule {}
