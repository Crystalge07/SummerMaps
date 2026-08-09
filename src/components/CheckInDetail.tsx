import { format } from "date-fns";
import { displayCreatedAt, promptForCheckIn } from "@/lib/prompts";
import type { CheckIn } from "@/lib/types";

export function CheckInDetail({
  checkIn,
  anonymize = false,
}: {
  checkIn: CheckIn | null;
  anonymize?: boolean;
}) {
  if (!checkIn) return null;

  const when = format(displayCreatedAt(checkIn.created_at), "MMM d · h:mm a");
  const place = checkIn.location_name?.trim() || "";
  const prompt = promptForCheckIn(checkIn.created_at);

  return (
    <aside className="detail">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={checkIn.photo_url} alt="" />
      <div>
        <strong>{when}</strong>
        {place ? <p className="checkin-location detail-place">{place}</p> : null}
        <p className="meta">Prompt: {prompt}</p>
        {checkIn.caption && !anonymize && <p>{checkIn.caption}</p>}
      </div>
    </aside>
  );
}
