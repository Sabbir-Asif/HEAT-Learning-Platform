import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CaptchaModule } from "../captcha";
import { RateLimitModule } from "../rate-limit";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";

@Module({
  imports: [AuthModule, CaptchaModule, RateLimitModule],
  controllers: [EnrollmentController],
  providers: [EnrollmentService],
})
export class EnrollmentModule {}
