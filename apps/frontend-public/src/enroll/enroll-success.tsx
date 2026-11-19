import { Button } from "@heat/ui";
import { ArrowRightIcon, MailCheckIcon } from "lucide-react";
import Link from "next/link";

interface EnrollSuccessProps {
  email: string;
}

const nextSteps = [
  "Open the email we just sent and select the verification link.",
  "An administrator reviews your request.",
  "Sign in and start learning once you are approved.",
];

export function EnrollSuccess({ email }: EnrollSuccessProps) {
  return (
    <div className="flex flex-col gap-6" role="status">
      <span className="bg-primary text-primary-foreground ring-primary/25 grid size-16 place-items-center rounded-full ring-8">
        <MailCheckIcon aria-hidden="true" className="size-8" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground text-base text-pretty">
          We sent a verification link to <strong className="text-foreground">{email}</strong>. Open
          it to verify your email address, then sign in.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {nextSteps.map((text, index) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
              {index + 1}
            </span>
            <span className="pt-0.5">{text}</span>
          </li>
        ))}
      </ol>
      <Button size="lg" className="h-11" nativeButton={false} render={<Link href="/sign-in" />}>
        Go to sign in
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </div>
  );
}
