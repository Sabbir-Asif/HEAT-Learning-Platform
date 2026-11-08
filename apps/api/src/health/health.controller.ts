import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { HealthResponseDto } from "./health.dto";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponseDto {
    return { status: "ok" };
  }
}
