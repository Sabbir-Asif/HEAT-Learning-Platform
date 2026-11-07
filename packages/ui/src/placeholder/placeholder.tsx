export interface PlaceholderProps {
  heading: string;
  text: string;
  actionLabel: string;
}

export function Placeholder({ heading, text, actionLabel }: PlaceholderProps) {
  return (
    <section className="heat-placeholder">
      <h2>{heading}</h2>
      <p>{text}</p>
      <button type="button">{actionLabel}</button>
    </section>
  );
}
