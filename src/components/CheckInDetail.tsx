import { format } from "date-fns";
import { formatApproxLocation } from "@/lib/geo";
import type { CheckIn } from "@/lib/types";

export function CheckInDetail({
  checkIn,
  anonymize = false,
}: {
  checkIn: CheckIn | null;
  anonymize?: boolean;
}) {
  if (!checkIn) return null;

  const when = format(new Date(checkIn.created_at), "MMM d · h:mm a");
  const place = formatApproxLocation(checkIn.lat, checkIn.lng);

  return (
    <aside className="detail">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={checkIn.photo_url} alt="" />
      <div>
        <strong>{when}</strong>
        <p className="meta detail-place">{place}</p>
        {checkIn.prompt && (
          <p className="meta">Prompt: {checkIn.prompt}</p>
        )}
        {checkIn.caption && !anonymize && <p>{checkIn.caption}</p>}
        {anonymize && <p>Someone spotted today&apos;s prompt here.</p>}
      </div>
    </aside>
  );
}
