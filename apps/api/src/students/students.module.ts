import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { StudentExportController } from "./student-export.controller";
import { StudentExportService } from "./student-export.service";

@Module({
  imports: [CoreModule, AuditModule, AuthModule, RateLimitModule],
  controllers: [StudentExportController],
  providers: [StudentExportService],
})
export class StudentsModule {}
