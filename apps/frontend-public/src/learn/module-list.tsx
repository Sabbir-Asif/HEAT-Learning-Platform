import { Badge, Button, Progress, ProgressLabel } from "@heat/ui";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CirclePlayIcon,
  ClipboardCheckIcon,
  LockIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  lockedReason,
  moduleActionLabel,
  moduleHref,
  moduleStateLabel,
  quizSummaryOf,
  watchRequirementOf,
} from "./learning-view";
import type { LearningModule } from "./learning-view";

const stateIcon: Record<LearningModule["state"], LucideIcon> = {
  LOCKED: LockIcon,
  UNLOCKED: CircleDashedIcon,
  IN_PROGRESS: CirclePlayIcon,
  QUIZ_READY: ClipboardCheckIcon,
  COMPLETED: CheckCircle2Icon,
};

const stateVariant = {
  LOCKED: "outline",
  UNLOCKED: "secondary",
  IN_PROGRESS: "secondary",
  QUIZ_READY: "default",
  COMPLETED: "default",
} as const;

export function ModuleStateBadge({ state }: { state: LearningModule["state"] }) {
  const Icon = stateIcon[state];
  return (
    <Badge variant={stateVariant[state]} data-state={state}>
      <Icon aria-hidden="true" />
      {moduleStateLabel[state]}
    </Badge>
  );
}

export interface ModuleListProps {
  courseSlug: string;
  modules: readonly LearningModule[];
  currentModuleId?: string;
  compact?: boolean;
}

const nodeClass: Record<LearningModule["state"], string> = {
  LOCKED: "bg-muted text-muted-foreground",
  UNLOCKED: "bg-accent text-accent-foreground",
  IN_PROGRESS: "bg-primary text-primary-foreground",
  QUIZ_READY: "bg-primary text-primary-foreground",
  COMPLETED: "bg-primary text-primary-foreground",
};

export function ModuleList({
  courseSlug,
  modules,
  currentModuleId,
  compact = false,
}: ModuleListProps) {
  return (
    <ol className="flex flex-col">
      {modules.map((module, index) => {
        const requirement = watchRequirementOf(module);
        const quiz = quizSummaryOf(courseSlug, module);
        const current = module.id === currentModuleId;
        const Icon = stateIcon[module.state];
        const last = index === modules.length - 1;
        return (
          <li
            key={module.id}
            aria-current={current ? "true" : undefined}
            className={`relative flex last:pb-0 ${compact ? "gap-3 pb-3" : "gap-4 pb-4"}`}
          >
            {last ? null : (
              <span
                aria-hidden="true"
                className={`bg-border absolute bottom-0 w-px -translate-x-1/2 ${compact ? "top-9 left-4" : "top-11 left-5"}`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative z-10 grid shrink-0 place-items-center rounded-full ${compact ? "size-8" : "size-10"} ${nodeClass[module.state]}`}
            >
              <Icon className={compact ? "size-4" : "size-5"} />
            </span>
            <div
              className={`bg-card flex min-w-0 flex-1 flex-col rounded-xl ring-1 ${compact ? "gap-2 p-3" : "gap-3 p-4"} ${
                current ? "ring-primary ring-2" : "ring-divider"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3
                  className={`font-heading min-w-0 font-semibold ${compact ? "text-sm" : "text-base"}`}
                >
                  {module.order}. {module.title}
                </h3>
                <ModuleStateBadge state={module.state} />
              </div>
              {module.state === "LOCKED" ? (
                <p className="text-muted-foreground text-sm">{lockedReason(modules, index)}</p>
              ) : (
                <>
                  {requirement.total > 0 && !compact ? (
                    <Progress value={requirement.percent}>
                      <ProgressLabel>{requirement.text}</ProgressLabel>
                    </Progress>
                  ) : null}
                  {quiz === null || compact ? null : (
                    <p className="text-muted-foreground text-sm">{quiz}</p>
                  )}
                  {current ? null : (
                    <div>
                      <Button
                        variant={module.state === "COMPLETED" ? "outline" : "default"}
                        nativeButton={false}
                        render={<Link href={moduleHref(courseSlug, module.id)} />}
                      >
                        {moduleActionLabel[module.state]}
                        <span className="sr-only"> {module.title}</span>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
