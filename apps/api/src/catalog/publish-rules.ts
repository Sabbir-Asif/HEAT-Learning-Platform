import type { PublishFailure } from "@heat/contracts";

export const minimumOptions = 2;
export const maximumOptions = 6;

export interface PublishQuestion {
  id: string;
  order: number;
  options: Array<{ isCorrect: boolean }>;
}

export interface PublishModule {
  id: string;
  order: number;
  title: string;
  videos: Array<{ required: boolean; status: string | null }>;
  quiz: { questions: PublishQuestion[] } | null;
}

const label = (module: PublishModule): string => `Module ${module.order} (${module.title})`;

const moduleFailure = (
  module: PublishModule,
  code: PublishFailure["code"],
  detail: string,
): PublishFailure => ({
  code,
  moduleId: module.id,
  questionId: null,
  message: `${label(module)} ${detail}`,
});

const questionFailures = (module: PublishModule, question: PublishQuestion): PublishFailure[] => {
  const failures: PublishFailure[] = [];
  const subject = `${label(module)}, question ${question.order}`;
  const count = question.options.length;
  if (count < minimumOptions || count > maximumOptions) {
    failures.push({
      code: "QUESTION_OPTION_COUNT",
      moduleId: module.id,
      questionId: question.id,
      message: `${subject} needs ${minimumOptions} to ${maximumOptions} options.`,
    });
  }
  if (question.options.filter((option) => option.isCorrect).length !== 1) {
    failures.push({
      code: "QUESTION_CORRECT_COUNT",
      moduleId: module.id,
      questionId: question.id,
      message: `${subject} needs exactly one correct option.`,
    });
  }
  return failures;
};

const videoFailures = (module: PublishModule): PublishFailure[] => {
  const required = module.videos.filter((video) => video.required);
  if (required.length === 0) {
    return [moduleFailure(module, "MODULE_NO_REQUIRED_VIDEO", "has no required video.")];
  }
  if (required.some((video) => video.status !== "READY")) {
    return [
      moduleFailure(module, "MODULE_VIDEO_NOT_READY", "has a required video that is not ready."),
    ];
  }
  return [];
};

const quizFailures = (module: PublishModule): PublishFailure[] => {
  if (module.quiz === null) return [moduleFailure(module, "MODULE_NO_QUIZ", "has no quiz.")];
  if (module.quiz.questions.length === 0) {
    return [moduleFailure(module, "MODULE_QUIZ_EMPTY", "has a quiz with no questions.")];
  }
  return module.quiz.questions.flatMap((question) => questionFailures(module, question));
};

export const evaluatePublishChecks = (modules: PublishModule[]): PublishFailure[] => {
  if (modules.length === 0) {
    return [
      {
        code: "COURSE_NO_MODULES",
        moduleId: null,
        questionId: null,
        message: "The course has no modules.",
      },
    ];
  }
  return modules.flatMap((module) => [...videoFailures(module), ...quizFailures(module)]);
};
