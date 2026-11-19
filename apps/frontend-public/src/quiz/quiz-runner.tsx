"use client";

import type { QuizDeliveryQuestion } from "@heat/contracts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Progress,
  ProgressLabel,
  ProgressValue,
  QuizQuestion,
  cn,
} from "@heat/ui";
import { ArrowLeftIcon, ArrowRightIcon, SendIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatAttemptTime } from "../learn/learning-view";
import { browserStorage, createAnswerStore } from "./quiz-answer-store";
import type { QuizAnswers, StorageLike } from "./quiz-answer-store";
import {
  answeredCountOf,
  answeredPercentOf,
  firstUnansweredIndex,
  unansweredOf,
} from "./quiz-review";
import type { QuizSubmitOutcome, SubmitQuiz } from "./quiz-submit";

export interface QuizRunnerProps {
  attemptId: string;
  questions: readonly QuizDeliveryQuestion[];
  submit: SubmitQuiz;
  onSubmitted: (attemptId: string) => void;
  storage?: StorageLike | null;
}

const failureNotice = (outcome: Exclude<QuizSubmitOutcome, { status: "SUBMITTED" }>): string => {
  if (outcome.status === "WAITING") {
    return outcome.nextAttemptAt === null
      ? "You need to wait before submitting another attempt."
      : `You can submit your next attempt on ${formatAttemptTime(outcome.nextAttemptAt)}.`;
  }
  if (outcome.status === "EXHAUSTED") return "You have used all your attempts for this quiz.";
  if (outcome.status === "CLOSED") {
    return "This attempt can no longer be submitted. Go back to the module and open the quiz again.";
  }
  return "Your answers could not be submitted. Check your connection and try again.";
};

export function QuizRunner({
  attemptId,
  questions,
  submit,
  onSubmitted,
  storage = browserStorage(),
}: QuizRunnerProps) {
  const store = useMemo(
    () => createAnswerStore(attemptId, questions, storage),
    [attemptId, questions, storage],
  );
  const [answers, setAnswers] = useState<QuizAnswers>(() => store.load());
  const [step, setStep] = useState(() => firstUnansweredIndex(questions, store.load()));
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const reviewHeading = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    (questionHeading.current ?? reviewHeading.current)?.focus();
  }, [step]);

  const total = questions.length;
  const answered = answeredCountOf(questions, answers);
  const goTo = (index: number) => {
    moved.current = true;
    setNotice(null);
    setStep(index);
  };
  const choose = (questionId: string, optionId: string) => {
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    store.save(next);
  };
  const submitAnswers = async () => {
    setSubmitting(true);
    setNotice(null);
    const outcome = await submit({ attemptId, answers });
    setSubmitting(false);
    if (outcome.status === "SUBMITTED") {
      store.clear();
      onSubmitted(outcome.attemptId);
      return;
    }
    setNotice(failureNotice(outcome));
  };

  const question = questions[step];
  const unanswered = unansweredOf(questions, answers);
  return (
    <Card className="mx-auto w-full max-w-3xl [--card-spacing:--spacing(6)] md:[--card-spacing:--spacing(8)]">
      <CardHeader>
        <Progress value={answeredPercentOf(answered, total)}>
          <ProgressLabel>
            {answered} of {total} answered
          </ProgressLabel>
          <ProgressValue />
        </Progress>
        <ol aria-label="Questions" className="flex flex-wrap gap-2 pt-2">
          {questions.map((entry, index) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-label={`Go to question ${index + 1}`}
                aria-current={index === step ? "step" : undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "focus-visible:ring-ring/50 grid size-9 place-items-center rounded-lg text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none",
                  index === step
                    ? "bg-primary text-primary-foreground"
                    : answers[entry.id] === undefined
                      ? "bg-muted text-muted-foreground hover:bg-secondary"
                      : "bg-accent text-accent-foreground hover:bg-secondary",
                )}
              >
                {index + 1}
              </button>
            </li>
          ))}
        </ol>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {question === undefined ? (
          <div className="flex flex-col gap-4">
            <CardTitle ref={reviewHeading} tabIndex={-1} className="font-heading text-2xl">
              <h2>Review your answers</h2>
            </CardTitle>
            {unanswered.length === 0 ? (
              <CardDescription>All {total} questions are answered.</CardDescription>
            ) : (
              <div className="flex flex-col gap-2">
                <CardDescription>
                  {unanswered.length === 1
                    ? "1 question is not answered yet."
                    : `${unanswered.length} questions are not answered yet.`}
                </CardDescription>
                <ul className="flex flex-col gap-1">
                  {unanswered.map((entry) => (
                    <li key={entry.id}>
                      <Button
                        variant="link"
                        nativeButton={false}
                        render={
                          <a
                            href={`#question-${entry.number}`}
                            onClick={(event) => {
                              event.preventDefault();
                              goTo(entry.index);
                            }}
                          />
                        }
                      >
                        Question {entry.number}: {entry.text}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <QuizQuestion
            key={question.id}
            id={`question-${step + 1}`}
            headingRef={questionHeading}
            number={step + 1}
            total={total}
            text={question.text}
            options={question.options}
            value={answers[question.id] ?? null}
            onValueChange={(optionId) => choose(question.id, optionId)}
          />
        )}
        {notice === null ? null : <CardDescription role="alert">{notice}</CardDescription>}
      </CardContent>
      <CardFooter className="flex justify-between gap-3 border-t">
        <Button
          variant="outline"
          disabled={step === 0 || submitting}
          onClick={() => goTo(step - 1)}
        >
          <ArrowLeftIcon aria-hidden="true" />
          Previous
        </Button>
        {question === undefined ? (
          <Button disabled={submitting} onClick={() => void submitAnswers()}>
            {submitting ? "Submitting" : "Submit answers"}
            <SendIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={() => goTo(step + 1)}>
            {step === total - 1 ? "Review answers" : "Next"}
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
