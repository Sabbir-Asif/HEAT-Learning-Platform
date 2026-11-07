export interface PlaceholderProps {
  heading: string;
  text: string;
  actionLabel: string;
}

/**
 * Stand-in that proves the Storybook setup (theme, locale, axe). Not exported from the package;
 * delete it when the first real component (E1-3) lands.
 */
export function Placeholder({ heading, text, actionLabel }: PlaceholderProps) {
  return (
    <section className="heat-placeholder">
      <h2>{heading}</h2>
      <p>{text}</p>
      <button type="button">{actionLabel}</button>
    </section>
  );
}
