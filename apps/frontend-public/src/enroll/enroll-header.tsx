import { PageHeader, cn } from "@heat/ui";
import { CheckIcon, GraduationCapIcon } from "lucide-react";

const steps = ["Your details", "Your account"] as const;

interface EnrollHeaderProps {
  step: 1 | 2;
  title: string;
  description: string;
  courseTitle?: string;
}

export function EnrollHeader({ step, title, description, courseTitle }: EnrollHeaderProps) {
  return (
    <div className="flex flex-col gap-6">
      {courseTitle === undefined ? null : (
        <p className="bg-background/40 ring-foreground/10 flex items-center gap-2 self-start rounded-full py-1.5 pr-4 pl-2 text-sm font-medium ring-1 backdrop-blur-md">
          <span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-full">
            <GraduationCapIcon aria-hidden="true" className="size-3.5" />
          </span>
          <span className="min-w-0 truncate">{courseTitle}</span>
        </p>
      )}
      <ol aria-label="Enrollment progress" className="flex items-center">
        {steps.map((label, index) => {
          const number = index + 1;
          const done = number < step;
          const current = number === step;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={cn("flex items-center gap-3", index === 0 && "flex-1")}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                  done || current
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground/10 text-foreground/70",
                  current && "ring-primary/25 ring-4",
                )}
              >
                {done ? <CheckIcon className="size-4" /> : number}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  current || done ? "text-foreground" : "text-foreground/70",
                )}
              >
                {label}
              </span>
              {index === 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mr-3 h-0.5 min-w-6 flex-1 rounded-full",
                    done ? "bg-primary" : "bg-foreground/15",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <PageHeader title={title} description={description} />
    </div>
  );
}
