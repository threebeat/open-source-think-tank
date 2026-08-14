import {
  hostedPolisUnavailableCopy,
} from "@/lib/agenda/embed";

export function HostedPolisUnavailable() {
  const copy = hostedPolisUnavailableCopy();
  return (
    <div
      className="space-y-3 rounded-md border border-dashed border-border bg-surface-muted p-5"
      data-testid="hosted-polis-unavailable"
      role="status"
    >
      <p className="font-heading text-lg text-foreground">{copy.title}</p>
      <p className="text-sm text-muted-foreground">{copy.body}</p>
      <p className="text-xs text-muted-foreground">
        Exact-origin matching and CSP remain fail-closed. No third-party
        consultation script is requested.
      </p>
    </div>
  );
}
