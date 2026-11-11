import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiAcceptedResponse, ApiTags } from "@nestjs/swagger";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { Public } from "../auth";
import { RateLimit } from "../rate-limit";
import { EnrollmentAcceptedResponseDto, EnrollmentRequestDto } from "./enrollment.dto";
import { EnrollmentService } from "./enrollment.service";

@ApiTags("enrollment")
@Controller("enrollment")
export class EnrollmentController {
  constructor(private readonly enrollment: EnrollmentService) {}

  @Public()
  @RateLimit("enrollment")
  @Post()
  @HttpCode(202)
  @ApiAcceptedResponse({ type: EnrollmentAcceptedResponseDto })
  submit(
    @Body() body: EnrollmentRequestDto,
    @Req() request: AuditableRequest,
  ): Promise<EnrollmentAcceptedResponseDto> {
    return this.enrollment.submit(body, actorOf(request));
  }
}
