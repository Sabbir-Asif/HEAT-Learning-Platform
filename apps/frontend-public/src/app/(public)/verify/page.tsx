import { AwardIcon, FileSearchIcon, BadgeCheckIcon } from "lucide-react";
import { VerifyLookup } from "@/verify/verify-lookup";

export const metadata = {
  title: "Verify a certificate",
  description: "Check that a Women Safety Awareness Program certificate is genuine.",
};

const steps = [
  {
    icon: AwardIcon,
    title: "Find the number",
    description: "Every certificate has a 12-character number printed on it.",
  },
  {
    icon: FileSearchIcon,
    title: "Enter it below",
    description: "Letters and numbers only. Dashes and spaces are optional.",
  },
  {
    icon: BadgeCheckIcon,
    title: "See the result",
    description: "We show the holder, the course and the completion date.",
  },
];

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 md:px-6 md:py-16">
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">
          Verify a certificate
        </h1>
        <p className="text-body-lg text-muted-foreground max-w-xl text-pretty">
          Check that a Women Safety Awareness Program certificate is genuine and still valid.
        </p>
      </header>
      <section
        aria-label="Certificate lookup"
        className="bg-card ring-divider rounded-xl p-6 shadow-sm ring-1 md:p-8"
      >
        <VerifyLookup />
      </section>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, description }, index) => (
          <li
            key={title}
            className="bg-card/60 ring-divider flex flex-col gap-3 rounded-xl p-5 ring-1"
          >
            <span className="flex items-center gap-3">
              <span className="bg-accent text-accent-foreground grid size-9 place-items-center rounded-lg">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                Step {index + 1}
              </span>
            </span>
            <h2 className="font-heading text-base font-semibold">{title}</h2>
            <p className="text-muted-foreground text-sm text-pretty">{description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
