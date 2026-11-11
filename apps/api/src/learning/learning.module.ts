import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { LearningController } from "./learning.controller";
import { LearningStructureService } from "./learning-structure.service";

@Module({
  imports: [CoreModule, AuthModule, RateLimitModule],
  controllers: [LearningController],
  providers: [LearningStructureService],
})
export class LearningModule {}
