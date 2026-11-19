import { Button } from "@heat/ui";
import { CheckCircle2Icon, ClipboardCheckIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { quizActionOf } from "./learning-view";
import type { LearningModule } from "./learning-view";

export function QuizAction({ courseSlug, module }: { courseSlug: string; module: LearningModule }) {
  const action = quizActionOf(courseSlug, module);
  const hintId = useId();
  if (action.kind === "none") return null;
  if (action.kind === "done") {
    return (
      <div className="bg-accent text-accent-foreground flex items-center gap-3 rounded-xl p-5">
        <CheckCircle2Icon aria-hidden="true" className="size-6 shrink-0" />
        <p role="status" className="font-heading font-semibold">
          Quiz passed
        </p>
      </div>
    );
  }
  if (action.kind === "open") {
    return (
      <div className="bg-sidebar text-sidebar-foreground relative flex flex-col gap-5 overflow-hidden rounded-xl p-6 md:p-8">
        <span
          aria-hidden="true"
          className="bg-sidebar-primary/30 absolute -top-12 -right-12 size-48 rounded-full blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span
            aria-hidden="true"
            className="bg-sidebar-primary text-sidebar-primary-foreground grid size-12 shrink-0 place-items-center rounded-full"
          >
            <ClipboardCheckIcon className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-display text-xl font-semibold">Ready to test yourself?</p>
            <p className="text-sidebar-foreground/80 text-sm">
              Pass the short quiz to complete this module and open the next one.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          variant="secondary"
          className="relative w-full"
          nativeButton={false}
          render={<Link href={action.href} />}
        >
          Take the quiz
        </Button>
      </div>
    );
  }
  return (
    <div className="bg-card ring-divider flex flex-col gap-4 rounded-xl p-6 ring-1">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="bg-muted text-muted-foreground grid size-12 shrink-0 place-items-center rounded-full"
        >
          <LockIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-semibold">The quiz is waiting for you</p>
          <p id={hintId} className="text-muted-foreground text-sm">
            {action.reason}
          </p>
        </div>
      </div>
      <Button
        size="lg"
        className="w-full data-disabled:opacity-50"
        disabled
        focusableWhenDisabled
        aria-describedby={hintId}
      >
        Take the quiz
      </Button>
    </div>
  );
}
