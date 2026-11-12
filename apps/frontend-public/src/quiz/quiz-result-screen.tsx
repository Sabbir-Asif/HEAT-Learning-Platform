"use client";

import { useLearningStructure, useQuizResultGet } from "@heat/api-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  EmptyState,
  PageHeader,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { ListChecksIcon } from "lucide-react";
import Link from "next/link";
import {
  EnrollmentNoticeView,
  LearnError,
  LockedModuleView,
  MissingModuleView,
} from "../learn/learn-states";
import { courseHref, lessonViewOf, moduleHref } from "../learn/learning-view";
import { QuizLoading } from "./quiz-states";
import { ResultNextStepView, ResultReview, ResultSummary } from "./quiz-result-parts";
import { resultNextStepOf } from "./quiz-result-view";

export interface QuizResultScreenProps {
  courseId: string;
  moduleId: string;
  attemptId: string;
}

export function QuizResultScreen({ courseId, moduleId, attemptId }: QuizResultScreenProps) {
  const structure = useLearningStructure(courseId);
  const result = useQuizResultGet(courseId, moduleId, attemptId, {
    query: { retry: false, refetchOnWindowFocus: false },
  });
  if (structure.isPending || result.isPending) return <QuizLoading />;
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
  const { module, modules, courseSlug, courseTitle } = view;
  const header = (
    <PageHeader
      title={`${module.title} quiz result`}
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
              <BreadcrumbPage>Result</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    />
  );
  if (result.isError || result.data === undefined) {
    return (
      <ShellContent>
        {header}
        <EmptyState
          icon={ListChecksIcon}
          title="This result is not available"
          description="We could not find this quiz result."
        />
      </ShellContent>
    );
  }
  const data = result.data;
  const index = modules.findIndex((entry) => entry.id === module.id);
  return (
    <ShellContent>
      {header}
      <ResultSummary result={data} />
      <ResultNextStepView
        step={resultNextStepOf(data.passed, modules, index, courseSlug)}
        courseSlug={courseSlug}
      />
      {data.review === null ? null : <ResultReview review={data.review} />}
    </ShellContent>
  );
}
