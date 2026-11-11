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
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          Question {number} of {total}
        </p>
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl font-semibold outline-none"
        >
          {text}
        </h2>
      </div>
      <RadioGroup
        aria-labelledby={headingId}
        value={value ?? ""}
        onValueChange={(next) => onValueChange(String(next))}
      >
        {options.map((option) => (
          <label
            key={option.id}
            className="border-input hover:bg-muted has-data-checked:border-primary has-data-checked:bg-accent flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <RadioGroupItem value={option.id} className="mt-0.5" />
            <span>{option.text}</span>
          </label>
        ))}
      </RadioGroup>
    </section>
  );
}

export { QuizQuestion };
export type { QuizQuestionOption, QuizQuestionProps };
