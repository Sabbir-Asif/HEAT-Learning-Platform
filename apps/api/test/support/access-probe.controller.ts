import { Controller, Get, Param } from "@nestjs/common";
import { Audience, RequireCourseAccess, Roles } from "../../src/access";
import { CurrentSession } from "../../src/auth";
import type { AuthenticatedSession } from "../../src/auth";

@Controller("probe")
export class AccessProbeController {
  @Get("student")
  @Audience("student")
  student(@CurrentSession() session: AuthenticatedSession): { role: string } {
    return { role: session.role };
  }

  @Get("admin")
  @Audience("admin")
  @Roles("ADMIN", "SUPER_ADMIN")
  admin(@CurrentSession() session: AuthenticatedSession): { role: string } {
    return { role: session.role };
  }

  @Get("super-admin")
  @Audience("admin")
  @Roles("SUPER_ADMIN")
  superAdmin(): { ok: true } {
    return { ok: true };
  }

  @Get("courses/:courseId/content")
  @Audience("student")
  @RequireCourseAccess("courseId")
  content(@Param("courseId") courseId: string): { courseId: string } {
    return { courseId };
  }

  @Get("unannotated")
  unannotated(): { ok: true } {
    return { ok: true };
  }
}
