"use client";

import type { QuizResultResponse } from "@heat/contracts";
import { Button, QuizReviewQuestion, SectionHeading, cn } from "@heat/ui";
import { RotateCcwIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { courseHref } from "../learn/learning-view";
import { countdownText, remainingSecondsOf } from "./quiz-result-view";
import type { ResultNextStep } from "./quiz-result-view";

export function RetryCountdown({
  nextAttemptAt,
  retryHref,
}: {
  nextAttemptAt: string;
  retryHref: string;
}) {
  const [remaining, setRemaining] = useState(() => remainingSecondsOf(nextAttemptAt, new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(remainingSecondsOf(nextAttemptAt, new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, [nextAttemptAt]);
  if (remaining === 0) {
    return (
      <Button nativeButton={false} render={<Link href={retryHref} />}>
        Try again
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p>
        You can try again in <span data-slot="retry-countdown">{countdownText(remaining)}</span>
      </p>
      <div>
        <Button disabled>Try again</Button>
      </div>
    </div>
  );
}

const nextStepClass = "bg-card ring-divider flex flex-col gap-3 rounded-xl p-6 ring-1 md:p-8";

const attemptsText = (attemptsRemaining: number | null): string | null => {
  if (attemptsRemaining === null) return null;
  return `${attemptsRemaining} ${attemptsRemaining === 1 ? "attempt" : "attempts"} left.`;
};

export function ResultNextStepView({
  step,
  courseSlug,
}: {
  step: ResultNextStep;
  courseSlug: string;
}) {
  if (step.kind === "next-module") {
    return (
      <div className={nextStepClass}>
        <p>This module is complete.</p>
        <div>
          <Button nativeButton={false} render={<Link href={step.href} />}>
            Continue to {step.title}
          </Button>
        </div>
      </div>
    );
  }
  if (step.kind === "certificate") {
    return (
      <div className={nextStepClass}>
        <p>You finished the last module. Your certificate will be issued to you shortly.</p>
        <div>
          <Button nativeButton={false} render={<Link href={courseHref(courseSlug)} />}>
            Back to the course
          </Button>
        </div>
      </div>
    );
  }
  if (step.kind === "limit-reached") {
    return (
      <p role="status" className={nextStepClass}>
        You have used all your attempts. An administrator can grant you another attempt.
      </p>
    );
  }
  const attempts = attemptsText(step.attemptsRemaining);
  return (
    <div className={nextStepClass}>
      {attempts === null ? null : <p>{attempts}</p>}
      {step.kind === "wait" ? (
        <RetryCountdown nextAttemptAt={step.nextAttemptAt} retryHref={step.retryHref} />
      ) : (
        <div>
          <Button nativeButton={false} render={<Link href={step.retryHref} />}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function ResultSummary({ result }: { result: QuizResultResponse }) {
  const Icon = result.passed ? TrophyIcon : RotateCcwIcon;
  return (
    <section
      aria-label="Your result"
      className={cn(
        "flex flex-col gap-6 rounded-xl p-6 sm:flex-row sm:items-center md:p-8",
        result.passed
          ? "bg-sidebar text-sidebar-foreground"
          : "bg-card text-card-foreground ring-divider ring-1",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-16 shrink-0 place-items-center rounded-2xl [&>svg]:size-8",
          result.passed
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-accent text-accent-foreground",
        )}
      >
        <Icon />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <SectionHeading>{result.passed ? "You passed" : "You did not pass"}</SectionHeading>
        <p className={result.passed ? "text-sidebar-foreground/80" : "text-muted-foreground"}>
          {result.correctCount} of {result.totalQuestions} correct. Pass mark{" "}
          {result.passMarkPercent}%.
        </p>
      </div>
      <div className="flex flex-col sm:items-end">
        <span className="text-sm opacity-80">Your score</span>
        <span
          className={cn(
            "font-display text-5xl font-bold",
            !result.passed && "text-secondary-foreground",
          )}
        >
          {result.scorePercent}%
        </span>
      </div>
    </section>
  );
}

export function ResultReview({ review }: { review: NonNullable<QuizResultResponse["review"]> }) {
  return (
    <section aria-labelledby="quiz-review-heading" className="flex flex-col gap-4">
      <SectionHeading id="quiz-review-heading">Review your answers</SectionHeading>
      {review.map((question, index) => (
        <QuizReviewQuestion
          key={question.questionId}
          number={index + 1}
          text={question.text}
          options={question.options}
          selectedOptionId={question.selectedOptionId}
          correctOptionId={question.correctOptionId}
          explanation={question.explanation}
        />
      ))}
    </section>
  );
}
