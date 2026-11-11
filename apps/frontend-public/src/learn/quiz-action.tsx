import { Button, CardDescription } from "@heat/ui";
import Link from "next/link";
import { quizActionOf } from "./learning-view";
import type { LearningModule } from "./learning-view";

export function QuizAction({ courseSlug, module }: { courseSlug: string; module: LearningModule }) {
  const action = quizActionOf(courseSlug, module);
  if (action.kind === "none") return null;
  if (action.kind === "done") return <CardDescription role="status">Quiz passed</CardDescription>;
  if (action.kind === "open") {
    return (
      <div>
        <Button nativeButton={false} render={<Link href={action.href} />}>
          Take the quiz
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button disabled focusableWhenDisabled aria-describedby={`quiz-hint-${module.id}`}>
          Take the quiz
        </Button>
      </div>
      <CardDescription id={`quiz-hint-${module.id}`}>{action.reason}</CardDescription>
    </div>
  );
}
