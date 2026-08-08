type MetricWithExplanationProps = {
  label: string;
  value: string;
  explanation: string;
};

export function MetricWithExplanation({
  label,
  value,
  explanation,
}: MetricWithExplanationProps) {
  return (
    <figure className="rounded-md border border-border bg-surface p-4">
      <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </figcaption>
      <p className="mt-2 font-heading text-2xl text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{explanation}</p>
    </figure>
  );
}
