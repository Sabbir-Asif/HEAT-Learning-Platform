import {
  adminProfileChangeListResponseSchema,
  latestProfileChangeResponseSchema,
  profileChangeDecisionSchema,
  profileChangeIdParamsSchema,
  profileChangeQuerySchema,
  profileChangeRequestSchema,
  rejectProfileChangeRequestSchema,
  submitProfileChangeRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class SubmitProfileChangeRequestDto extends createZodDto(submitProfileChangeRequestSchema) {}
export class ProfileChangeRequestDto extends createZodDto(profileChangeRequestSchema) {}
export class LatestProfileChangeResponseDto extends createZodDto(
  latestProfileChangeResponseSchema,
) {}
export class ProfileChangeQueryDto extends createZodDto(profileChangeQuerySchema) {}
export class ProfileChangeIdParamsDto extends createZodDto(profileChangeIdParamsSchema) {}
export class RejectProfileChangeRequestDto extends createZodDto(rejectProfileChangeRequestSchema) {}
export class AdminProfileChangeListResponseDto extends createZodDto(
  adminProfileChangeListResponseSchema,
) {}
export class ProfileChangeDecisionDto extends createZodDto(profileChangeDecisionSchema) {}
