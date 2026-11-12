import { CheckIcon, XIcon } from "lucide-react";
import { useId } from "react";
import { cn } from "../lib/utils";

type QuizReviewOption = {
  id: string;
  text: string;
};

type QuizReviewQuestionProps = React.ComponentProps<"section"> & {
  number: number;
  text: string;
  options: readonly QuizReviewOption[];
  selectedOptionId: string | null;
  correctOptionId: string;
  explanation: string | null;
};

function QuizReviewQuestion({
  number,
  text,
  options,
  selectedOptionId,
  correctOptionId,
  explanation,
  className,
  ...props
}: QuizReviewQuestionProps) {
  const headingId = useId();
  return (
    <section
      data-slot="quiz-review-question"
      aria-labelledby={headingId}
      className={cn(
        "bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1",
        className,
      )}
      {...props}
    >
      <h3 id={headingId} className="font-heading text-base font-semibold">
        {number}. {text}
      </h3>
      <ul className="flex flex-col gap-2">
        {options.map((option) => {
          const correct = option.id === correctOptionId;
          const selected = option.id === selectedOptionId;
          return (
            <li key={option.id} className="flex items-start gap-2 text-sm">
              {correct ? (
                <CheckIcon aria-hidden="true" className="text-primary mt-0.5 size-4 shrink-0" />
              ) : selected ? (
                <XIcon aria-hidden="true" className="text-destructive mt-0.5 size-4 shrink-0" />
              ) : (
                <span aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className={cn(correct && "font-medium")}>
                {option.text}
                {correct ? <span className="sr-only"> (correct answer)</span> : null}
                {selected ? <span className="sr-only"> (your answer)</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {explanation === null ? null : <p className="text-muted-foreground text-sm">{explanation}</p>}
    </section>
  );
}

export { QuizReviewQuestion };
export type { QuizReviewOption, QuizReviewQuestionProps };
