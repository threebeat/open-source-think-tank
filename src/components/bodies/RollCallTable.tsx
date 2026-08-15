import { PublicTime } from "@/components/topics/PublicTime";
import type { RollCallRowDto } from "@/lib/bodies/types";

type RollCallTableProps = {
  caption: string;
  rows: RollCallRowDto[];
  timezone: string;
  onSelectRow?: (memberPublicId: string) => void;
  selectedMemberPublicId?: string | null;
};

export function RollCallTable({
  caption,
  rows,
  timezone,
  onSelectRow,
  selectedMemberPublicId,
}: RollCallTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No roll call has been published for this session.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="mb-3 text-left text-base font-medium">
          {caption} Times are shown in {timezone}.
        </caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-2 pr-4 font-medium">
              Member
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Position
            </th>
            <th scope="col" className="py-2 font-medium">
              Recorded
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.memberPublicId}
              className={
                selectedMemberPublicId === row.memberPublicId
                  ? "border-b border-border bg-primary/10"
                  : "border-b border-border"
              }
            >
              <th scope="row" className="py-2 pr-4 font-medium">
                {onSelectRow ? (
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    aria-pressed={selectedMemberPublicId === row.memberPublicId}
                    onClick={() => onSelectRow(row.memberPublicId)}
                  >
                    {row.displayName}
                  </button>
                ) : (
                  row.displayName
                )}
              </th>
              <td className="py-2 pr-4">{row.position}</td>
              <td className="py-2">
                <PublicTime dateTime={row.recordedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
