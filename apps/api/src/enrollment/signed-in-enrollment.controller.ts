import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { SignedInEnrollmentRequestDto, SignedInEnrollmentResponseDto } from "./enrollment.dto";
import { SignedInEnrollmentService } from "./signed-in-enrollment.service";

@ApiTags("enrollment")
@Controller("me/enrollments")
@Audience("student")
export class SignedInEnrollmentController {
  constructor(private readonly enrollments: SignedInEnrollmentService) {}

  @RateLimit("enrollment")
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: SignedInEnrollmentResponseDto })
  request(
    @Body() body: SignedInEnrollmentRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<SignedInEnrollmentResponseDto> {
    return this.enrollments.request(session.userId, body);
  }
}
