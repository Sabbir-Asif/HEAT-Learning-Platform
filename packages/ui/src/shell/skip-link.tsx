import { cn } from "../lib/utils";

const MAIN_CONTENT_ID = "main-content";

function SkipLink({
  className,
  children = "Skip to main content",
  ...props
}: Omit<React.ComponentProps<"a">, "href">) {
  return (
    <a
      data-slot="skip-link"
      href={`#${MAIN_CONTENT_ID}`}
      className={cn(
        "bg-background text-foreground ring-ring focus-visible:ring-ring sr-only rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:ring-2",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

function ShellMain({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="shell-main"
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className={cn("min-w-0 flex-1 outline-none", className)}
      {...props}
    />
  );
}

function ShellContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="shell-content"
      className={cn(
        "mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8",
        className,
      )}
      {...props}
    />
  );
}

function ShellHeader({
  className,
  contained = false,
  children,
  ...props
}: React.ComponentProps<"header"> & { contained?: boolean }) {
  return (
    <header
      data-slot="shell-header"
      className={cn(
        "bg-background/80 border-border sticky top-0 z-20 border-b backdrop-blur-md",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex min-h-14 w-full items-center gap-2 px-4 md:px-6",
          contained && "mx-auto max-w-7xl",
        )}
      >
        {children}
      </div>
    </header>
  );
}

export { MAIN_CONTENT_ID, ShellContent, ShellHeader, ShellMain, SkipLink };
