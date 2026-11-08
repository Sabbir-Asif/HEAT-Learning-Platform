import type { ReactNode } from "react";
import { describeShadow, tokens, type ThemeName } from "./token-data";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-heading-2 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Entry({ name, value, children }: { name: string; value: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      {children}
      <span className="flex flex-col">
        <span className="text-label">{name}</span>
        <span className="text-small text-muted-foreground">{value}</span>
      </span>
    </li>
  );
}

const gridClass = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

export function TokensPage({ theme }: { theme: ThemeName }) {
  const colours = Object.entries(tokens.colors[theme]);
  return (
    <main className="bg-background text-foreground p-6">
      <h1 className="text-heading-1 mb-8">Design tokens, {theme}</h1>

      <Section title="Colour roles">
        <ul className={gridClass}>
          {colours.map(([role, value]) => (
            <Entry key={role} name={role} value={value}>
              <span
                className="size-10 shrink-0 rounded-md border"
                style={{ backgroundColor: `var(--${role})` }}
              />
            </Entry>
          ))}
        </ul>
      </Section>

      <Section title="Type styles">
        <ul className="flex flex-col gap-4">
          {Object.entries(tokens.type.styles).map(([name, style]) => (
            <li key={name}>
              <p className="text-small text-muted-foreground">
                {name}, {style.size}px, line height {style.lineHeight}px, weight {style.weight}
              </p>
              <p
                className={
                  name.startsWith("body") || name === "label" || name === "small"
                    ? ""
                    : "font-display"
                }
                style={{
                  fontSize: `var(--text-${name})`,
                  lineHeight: `var(--text-${name}--line-height)`,
                  fontWeight: `var(--text-${name}--font-weight)`,
                }}
              >
                Safe campuses begin with everyone knowing how to speak up.
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Font weights">
        <ul className="flex flex-col gap-2">
          <li className="font-display text-heading-3 font-semibold">
            Source Serif 4, 600: Reporting is a right
          </li>
          <li className="font-display text-heading-3 font-bold">
            Source Serif 4, 700: Reporting is a right
          </li>
          <li className="text-body font-sans font-normal">
            Public Sans, 400: Support is available
          </li>
          <li className="text-body font-sans font-semibold">
            Public Sans, 600: Support is available
          </li>
          <li className="text-body font-sans font-bold">Public Sans, 700: Support is available</li>
        </ul>
      </Section>

      <Section title="Radius">
        <ul className={gridClass}>
          {Object.entries(tokens.radius).map(([name, pixels]) => (
            <Entry key={name} name={name} value={`${pixels}px`}>
              <span
                className="bg-secondary size-12 shrink-0 border"
                style={{ borderRadius: `var(--radius-${name})` }}
              />
            </Entry>
          ))}
        </ul>
      </Section>

      <Section title="Spacing">
        <ul className="flex flex-col gap-2">
          {Object.entries(tokens.spacing.scale).map(([step, pixels]) => (
            <Entry key={step} name={step} value={`${pixels}px`}>
              <span
                className="bg-primary h-4 shrink-0"
                style={{ width: `calc(var(--spacing) * ${step})` }}
              />
            </Entry>
          ))}
        </ul>
      </Section>

      <Section title="Shadows">
        <ul className={gridClass}>
          {Object.entries(tokens.shadows[theme]).map(([name, layers]) => (
            <Entry key={name} name={name} value={describeShadow(layers)}>
              <span
                className="bg-card size-12 shrink-0 rounded-md"
                style={{ boxShadow: `var(--elevation-${name})` }}
              />
            </Entry>
          ))}
        </ul>
      </Section>
    </main>
  );
}
