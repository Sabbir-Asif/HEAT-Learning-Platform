import type { QuizDeliveryResponse } from "@heat/contracts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { ClockIcon, LockIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { formatAttemptTime, moduleHref } from "../learn/learning-view";

const backAction = (courseSlug: string, moduleId: string) => (
  <Button
    variant="outline"
    nativeButton={false}
    render={<Link href={moduleHref(courseSlug, moduleId)} />}
  >
    Back to the module
  </Button>
);

export function QuizLoading() {
  return (
    <ShellContent aria-busy="true" data-slot="quiz-loading">
      <p role="status" className="sr-only">
        Loading the quiz
      </p>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-48 w-full" />
    </ShellContent>
  );
}

export function QuizWaiting({
  courseSlug,
  moduleId,
  nextAttemptAt,
}: {
  courseSlug: string;
  moduleId: string;
  nextAttemptAt: string;
}) {
  return (
    <EmptyState
      icon={ClockIcon}
      title="You can try again later"
      description={`Your next attempt opens on ${formatAttemptTime(nextAttemptAt)}.`}
      action={backAction(courseSlug, moduleId)}
    />
  );
}

export function QuizExhausted({
  courseSlug,
  moduleId,
  attemptsUsed,
}: {
  courseSlug: string;
  moduleId: string;
  attemptsUsed: number;
}) {
  return (
    <EmptyState
      icon={LockIcon}
      title="No attempts left"
      description={`You have used all ${attemptsUsed} attempts for this quiz. Contact your course administrator to ask for more.`}
      action={backAction(courseSlug, moduleId)}
    />
  );
}

export function QuizPassed({
  courseSlug,
  moduleId,
  result,
  passMarkPercent,
}: {
  courseSlug: string;
  moduleId: string;
  result: QuizDeliveryResponse["bestResult"];
  passMarkPercent: number | null;
}) {
  if (result === null) {
    return (
      <EmptyState
        icon={TrophyIcon}
        title="Quiz passed"
        description="This module is complete."
        action={backAction(courseSlug, moduleId)}
      />
    );
  }
  return (
    <Card className="max-w-3xl">
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground grid size-14 shrink-0 place-items-center rounded-2xl [&>svg]:size-7"
        >
          <TrophyIcon />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle>
            <h2>You passed this quiz with {result.scorePercent}%</h2>
          </CardTitle>
          <CardDescription>
            {passMarkPercent === null ? "" : `Pass mark ${passMarkPercent}%. `}
            Submitted on {formatAttemptTime(result.submittedAt)}.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            render={
              <Link href={`${moduleHref(courseSlug, moduleId)}/quiz/result/${result.attemptId}`} />
            }
          >
            View result
          </Button>
          {backAction(courseSlug, moduleId)}
        </div>
      </CardContent>
    </Card>
  );
}
