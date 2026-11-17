import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiProduces, ApiTags } from "@nestjs/swagger";
import { studentExportFileName } from "@heat/contracts";
import { pipeline, Readable } from "node:stream";
import type { Writable } from "node:stream";
import { Audience, Roles } from "../access";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { StudentExportQueryDto } from "./student-export.dto";
import { StudentExportService } from "./student-export.service";

export interface CsvResponse extends Writable {
  setHeader(name: string, value: string): unknown;
}

@ApiTags("students")
@Controller("admin/students")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class StudentExportController {
  constructor(private readonly exports: StudentExportService) {}

  @RateLimit("studentExport")
  @Get("export")
  @ApiProduces("text/csv")
  @ApiOkResponse({
    description: "The filtered student list as a streamed CSV file",
    content: { "text/csv": { schema: { type: "string", format: "binary" } } },
  })
  download(
    @Query() query: StudentExportQueryDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
    @Res() response: CsvResponse,
  ): void {
    const abort = new AbortController();
    response.once("close", () => {
      if (!response.writableFinished) abort.abort();
    });
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${studentExportFileName}"`);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const source = Readable.from(
      this.exports.stream(query, actorOf(request, session.userId), abort.signal),
    );
    pipeline(source, response, () => undefined);
  }
}
