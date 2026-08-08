import { format } from "date-fns";
import type { CheckIn } from "@/lib/types";

export function CheckInDetail({
  checkIn,
  anonymize = false,
}: {
  checkIn: CheckIn | null;
  anonymize?: boolean;
}) {
  if (!checkIn) return null;
  return (
    <aside className="detail">
      {!anonymize && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={checkIn.photo_url} alt="" />
      )}
      <div>
        <strong>{format(new Date(checkIn.created_at), "h:mm a")}</strong>
        {checkIn.caption && !anonymize && <p>{checkIn.caption}</p>}
        {anonymize && <p>Anonymous city stop</p>}
      </div>
    </aside>
  );
}
