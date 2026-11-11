import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { LearningController } from "./learning.controller";
import { LessonContentController } from "./lesson-content.controller";
import { LessonContentService } from "./lesson-content.service";
import { QuizAccessController } from "./quiz-access.controller";
import { QuizDeliveryController } from "./quiz-delivery.controller";
import { QuizDeliveryService } from "./quiz-delivery.service";
import { QuizGateService } from "./quiz-gate";
import { QuizSubmissionController } from "./quiz-submission.controller";
import { QuizSubmissionService } from "./quiz-submission.service";
import { ModuleCompletionService } from "./module-completion.service";
import { QUIZ_SCORED_HANDLERS } from "./quiz-scored-handler";
import { LearningStructureService } from "./learning-structure.service";

@Module({
  imports: [CoreModule, AuthModule, RateLimitModule],
  controllers: [
    DashboardController,
    LearningController,
    LessonContentController,
    QuizAccessController,
    QuizDeliveryController,
    QuizSubmissionController,
  ],
  providers: [
    DashboardService,
    LearningStructureService,
    LessonContentService,
    QuizGateService,
    QuizDeliveryService,
    QuizSubmissionService,
    ModuleCompletionService,
    {
      provide: QUIZ_SCORED_HANDLERS,
      useFactory: (completion: ModuleCompletionService) => [completion],
      inject: [ModuleCompletionService],
    },
  ],
  exports: [QuizGateService],
})
export class LearningModule {}
