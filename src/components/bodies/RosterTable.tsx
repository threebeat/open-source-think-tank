import { PublicTime } from "@/components/topics/PublicTime";
import type { RosterSeatDto } from "@/lib/bodies/types";

type RosterTableProps = {
  caption: string;
  seats: RosterSeatDto[];
};

export function RosterTable({ caption, seats }: RosterTableProps) {
  if (seats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No synthetic roster is listed for this organization.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="mb-3 text-left text-base font-medium">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-2 pr-4 font-medium">
              Member
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Seat
            </th>
            <th scope="col" className="py-2 font-medium">
              Term starts
            </th>
          </tr>
        </thead>
        <tbody>
          {seats.map((seat) => (
            <tr key={seat.memberPublicId} className="border-b border-border">
              <th scope="row" className="py-2 pr-4 font-medium">
                {seat.displayName}
                {seat.appointmentKind.includes("clerk") ? " (clerk)" : null}
              </th>
              <td className="py-2 pr-4">{seat.appointmentKind}</td>
              <td className="py-2">
                <PublicTime dateTime={seat.termStartsAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
