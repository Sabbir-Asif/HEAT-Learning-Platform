export interface PlaceholderProps {
  heading: string;
  text: string;
  actionLabel: string;
}

export function Placeholder({ heading, text, actionLabel }: PlaceholderProps) {
  return (
    <section className="bg-background text-foreground p-4">
      <h2 className="text-heading-2">{heading}</h2>
      <p>{text}</p>
      <button
        type="button"
        className="bg-primary text-primary-foreground mt-4 rounded-md px-4 py-2"
      >
        {actionLabel}
      </button>
    </section>
  );
}
