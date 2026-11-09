import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CurrentSession, StudentAuthGuard } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { MeResponseDto } from "./me.dto";
import { MeService } from "./me.service";

@ApiTags("me")
@Controller("me")
@UseGuards(StudentAuthGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  describe(@CurrentSession() session: AuthenticatedSession): Promise<MeResponseDto> {
    return this.me.describe(session.userId);
  }
}
