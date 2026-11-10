import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { MeResponseDto } from "./me.dto";
import { MeService } from "./me.service";

@ApiTags("me")
@Controller("me")
@Audience("student")
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  describe(@CurrentSession() session: AuthenticatedSession): Promise<MeResponseDto> {
    return this.me.describe(session.userId);
  }
}
