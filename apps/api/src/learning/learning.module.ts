import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { LearningController } from "./learning.controller";
import { LessonContentController } from "./lesson-content.controller";
import { LessonContentService } from "./lesson-content.service";
import { QuizAccessController } from "./quiz-access.controller";
import { QuizGateService } from "./quiz-gate";
import { LearningStructureService } from "./learning-structure.service";

@Module({
  imports: [CoreModule, AuthModule, RateLimitModule],
  controllers: [LearningController, LessonContentController, QuizAccessController],
  providers: [LearningStructureService, LessonContentService, QuizGateService],
  exports: [QuizGateService],
})
export class LearningModule {}
