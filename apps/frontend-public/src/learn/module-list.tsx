import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  ProgressLabel,
} from "@heat/ui";
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
}

export function ModuleList({ courseSlug, modules, currentModuleId }: ModuleListProps) {
  return (
    <ol className="flex flex-col gap-3">
      {modules.map((module, index) => {
        const requirement = watchRequirementOf(module);
        const quiz = quizSummaryOf(courseSlug, module);
        const current = module.id === currentModuleId;
        return (
          <li key={module.id} aria-current={current ? "true" : undefined}>
            <Card size="sm">
              <CardHeader>
                <CardTitle>
                  {module.order}. {module.title}
                </CardTitle>
                <CardAction>
                  <ModuleStateBadge state={module.state} />
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {module.state === "LOCKED" ? (
                  <CardDescription>{lockedReason(modules, index)}</CardDescription>
                ) : (
                  <>
                    {requirement.total > 0 ? (
                      <Progress value={requirement.percent}>
                        <ProgressLabel>{requirement.text}</ProgressLabel>
                      </Progress>
                    ) : null}
                    {quiz === null ? null : <CardDescription>{quiz}</CardDescription>}
                    {current ? null : (
                      <div>
                        <Button
                          variant="outline"
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
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
