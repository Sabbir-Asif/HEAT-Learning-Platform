import { CheckIcon } from "lucide-react";
import { Badge } from "../components/badge";
import { cn } from "../lib/utils";

type QuizPreviewOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

type QuizPreviewQuestion = {
  id: string;
  text: string;
  explanation: string | null;
  options: readonly QuizPreviewOption[];
};

type QuizPreviewProps = Omit<React.ComponentProps<"div">, "children"> & {
  questions: readonly QuizPreviewQuestion[];
};

function QuizPreview({ questions, className, ...props }: QuizPreviewProps) {
  return (
    <div data-slot="quiz-preview" className={cn("flex flex-col gap-6", className)} {...props}>
      {questions.map((question, index) => (
        <section
          key={question.id}
          aria-label={`Question ${index + 1} of ${questions.length}`}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-sm">
              Question {index + 1} of {questions.length}
            </p>
            <h3 className="font-heading text-lg font-semibold">{question.text}</h3>
          </div>
          <ul className="flex flex-col gap-2">
            {question.options.map((option) => (
              <li
                key={option.id}
                data-correct={option.isCorrect ? "true" : "false"}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-sm",
                  option.isCorrect ? "border-primary bg-accent" : "border-input",
                )}
              >
                {option.isCorrect ? <CheckIcon aria-hidden="true" className="mt-0.5 size-4" /> : null}
                <span className="flex-1">{option.text}</span>
                {option.isCorrect ? <Badge>Correct answer</Badge> : null}
              </li>
            ))}
          </ul>
          {question.explanation === null || question.explanation === "" ? null : (
            <p className="text-muted-foreground text-sm">{question.explanation}</p>
          )}
        </section>
      ))}
    </div>
  );
}

export { QuizPreview };
export type { QuizPreviewOption, QuizPreviewProps, QuizPreviewQuestion };
