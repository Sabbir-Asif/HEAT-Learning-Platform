"use client";

import type { QuizResultResponse } from "@heat/contracts";
import { Button, QuizReviewQuestion, SectionHeading, StatCard } from "@heat/ui";
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
      <div className="flex flex-col gap-3">
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
      <div className="flex flex-col gap-3">
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
      <p role="status">
        You have used all your attempts. An administrator can grant you another attempt.
      </p>
    );
  }
  const attempts = attemptsText(step.attemptsRemaining);
  return (
    <div className="flex flex-col gap-3">
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
  return (
    <div className="flex flex-col gap-3">
      <SectionHeading>{result.passed ? "You passed" : "You did not pass"}</SectionHeading>
      <StatCard label="Your score" value={`${result.scorePercent}%`} />
      <p>
        {result.correctCount} of {result.totalQuestions} correct. Pass mark {result.passMarkPercent}
        %.
      </p>
    </div>
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
