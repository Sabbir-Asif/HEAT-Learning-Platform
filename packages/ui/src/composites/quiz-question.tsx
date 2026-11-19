"use client";

import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "../components/radio-group";
import { cn } from "../lib/utils";

type QuizQuestionOption = {
  id: string;
  text: string;
};

type QuizQuestionProps = Omit<React.ComponentProps<"section">, "onChange"> & {
  number: number;
  total: number;
  text: string;
  options: readonly QuizQuestionOption[];
  value: string | null;
  onValueChange: (optionId: string) => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
};

function QuizQuestion({
  number,
  total,
  text,
  options,
  value,
  onValueChange,
  headingRef,
  className,
  ...props
}: QuizQuestionProps) {
  const headingId = useId();
  return (
    <section
      data-slot="quiz-question"
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-5", className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Question {number} of {total}
        </p>
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-2xl leading-snug font-semibold outline-none"
        >
          {text}
        </h2>
      </div>
      <RadioGroup
        aria-labelledby={headingId}
        value={value ?? ""}
        onValueChange={(next) => onValueChange(String(next))}
      >
        {options.map((option, index) => (
          <label
            key={option.id}
            className="border-divider bg-card hover:border-primary/50 hover:bg-accent/40 has-data-checked:border-primary has-data-checked:bg-accent has-data-checked:ring-primary flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 text-base transition-colors has-data-checked:ring-1"
          >
            <span
              aria-hidden="true"
              className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold"
            >
              {String.fromCharCode(65 + index)}
            </span>
            <span className="flex-1">{option.text}</span>
            <RadioGroupItem value={option.id} />
          </label>
        ))}
      </RadioGroup>
    </section>
  );
}

export { QuizQuestion };
export type { QuizQuestionOption, QuizQuestionProps };
