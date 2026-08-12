import { formatPublicDateTime } from "@/lib/format/public-datetime";
import { cn } from "@/lib/utils";

type PublicTimeProps = {
  dateTime: string;
  className?: string;
  /** Optional visible prefix such as "Published ". */
  prefix?: string;
};

/**
 * Semantic public timestamp with deterministic America/Chicago presentation.
 */
export function PublicTime({ dateTime, className, prefix }: PublicTimeProps) {
  return (
    <time dateTime={dateTime} className={cn(className)}>
      {prefix}
      {formatPublicDateTime(dateTime)}
    </time>
  );
}
