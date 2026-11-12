import { cn } from "../lib/utils";

function BodyText({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="body-text" className={cn("break-words", className)} {...props} />;
}

export { BodyText };
