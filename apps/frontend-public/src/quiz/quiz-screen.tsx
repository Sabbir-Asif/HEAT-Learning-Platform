"use client";

import { isApiError, useLearningStructure, useQuizDeliveryGet } from "@heat/api-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  EmptyState,
  PageHeader,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { ListChecksIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EnrollmentNoticeView,
  LearnError,
  LockedModuleView,
  MissingModuleView,
} from "../learn/learn-states";
import { courseHref, lessonViewOf, moduleHref, quizActionOf } from "../learn/learning-view";
import type { LearningModule } from "../learn/learning-view";
import { QuizExhausted, QuizLoading, QuizPassed, QuizWaiting } from "./quiz-states";
import { QuizRunner } from "./quiz-runner";
import { useQuizSubmit } from "./use-quiz-submit";

export interface QuizScreenProps {
  courseId: string;
  moduleId: string;
}

interface QuizBodyProps {
  courseId: string;
  courseSlug: string;
  module: LearningModule;
}

function QuizBody({ courseId, courseSlug, module }: QuizBodyProps) {
  const router = useRouter();
  const submit = useQuizSubmit(courseId, module.id);
  const delivery = useQuizDeliveryGet(courseId, module.id, {
    query: { staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, retry: false },
  });
  if (delivery.isPending) return <QuizLoading />;
  if (delivery.isError) {
    if (isApiError(delivery.error) && delivery.error.code === "QUIZ_NOT_UNLOCKED") {
      const action = quizActionOf(courseSlug, module);
      return (
        <EmptyState
          icon={ListChecksIcon}
          title="The quiz is locked"
          description={
            action.kind === "disabled"
              ? action.reason
              : "Watch the required videos to unlock this quiz."
          }
          action={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={moduleHref(courseSlug, module.id)} />}
            >
              Back to the module
            </Button>
          }
        />
      );
    }
    return <LearnError onRetry={() => void delivery.refetch()} />;
  }
  const data = delivery.data;
  if (data.status === "WAITING" && data.nextAttemptAt !== null) {
    return (
      <QuizWaiting
        courseSlug={courseSlug}
        moduleId={module.id}
        nextAttemptAt={data.nextAttemptAt}
      />
    );
  }
  if (data.status === "EXHAUSTED") {
    return (
      <QuizExhausted
        courseSlug={courseSlug}
        moduleId={module.id}
        attemptsUsed={data.attemptsUsed}
      />
    );
  }
  if (data.status === "PASSED") {
    return (
      <QuizPassed
        courseSlug={courseSlug}
        moduleId={module.id}
        result={data.bestResult}
        passMarkPercent={data.quiz?.passMarkPercent ?? null}
      />
    );
  }
  if (data.status === "AVAILABLE" && data.attempt !== null) {
    return (
      <QuizRunner
        attemptId={data.attempt.id}
        questions={data.questions}
        submit={submit}
        onSubmitted={(attemptId) =>
          router.push(`${moduleHref(courseSlug, module.id)}/quiz/result/${attemptId}`)
        }
      />
    );
  }
  return <LearnError onRetry={() => void delivery.refetch()} />;
}

export function QuizScreen({ courseId, moduleId }: QuizScreenProps) {
  const structure = useLearningStructure(courseId);
  if (structure.isPending) return <QuizLoading />;
  if (structure.isError || structure.data === undefined) {
    return <LearnError onRetry={() => void structure.refetch()} />;
  }
  const view = lessonViewOf(structure.data, moduleId);
  const { course } = structure.data;
  if (view.kind === "status") {
    return <EnrollmentNoticeView courseTitle={course.title} notice={view.notice} />;
  }
  if (view.kind === "missing") return <MissingModuleView courseSlug={course.slug} />;
  if (view.kind === "locked") {
    return (
      <LockedModuleView
        courseSlug={view.courseSlug}
        moduleTitle={view.module.title}
        reason={view.reason}
      />
    );
  }
  const { module, courseSlug, courseTitle } = view;
  return (
    <ShellContent>
      <PageHeader
        title={`${module.title} quiz`}
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={courseHref(courseSlug)} />}>
                  {courseTitle}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={moduleHref(courseSlug, module.id)} />}>
                  {module.title}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Quiz</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />
      {module.quiz === null ? (
        <EmptyState
          icon={ListChecksIcon}
          title="This module has no quiz"
          description="There is nothing to take here."
        />
      ) : (
        <QuizBody courseId={courseId} courseSlug={courseSlug} module={module} />
      )}
    </ShellContent>
  );
}
