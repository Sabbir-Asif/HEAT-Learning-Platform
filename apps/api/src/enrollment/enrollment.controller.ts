import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiAcceptedResponse, ApiTags } from "@nestjs/swagger";
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
  submit(@Body() body: EnrollmentRequestDto): Promise<EnrollmentAcceptedResponseDto> {
    return this.enrollment.submit(body);
  }
}
