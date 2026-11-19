import { Button } from "../components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { cn } from "../lib/utils";
import type { LucideIcon } from "lucide-react";

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  title: string;
  description?: string;
  breadcrumbs?: React.ReactNode;
  action?: React.ReactNode;
};

function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header data-slot="page-header" className={cn("flex flex-col gap-2", className)} {...props}>
      {breadcrumbs}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading min-w-0 text-3xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground text-base text-pretty">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

type PageHeaderActionProps = Omit<React.ComponentProps<typeof Button>, "children"> & {
  icon: LucideIcon;
  label: string;
};

function PageHeaderAction({ icon: Icon, label, ...props }: PageHeaderActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...props} />}>
        <Icon data-icon="inline-start" />
        <span className="max-md:sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent className="md:hidden">{label}</TooltipContent>
    </Tooltip>
  );
}

export { PageHeader, PageHeaderAction };
export type { PageHeaderActionProps, PageHeaderProps };
