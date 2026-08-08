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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={checkIn.photo_url} alt="" />
      <div>
        <strong>{format(new Date(checkIn.created_at), "h:mm a")}</strong>
        {checkIn.prompt && (
          <p className="meta">Prompt: {checkIn.prompt}</p>
        )}
        {checkIn.caption && !anonymize && <p>{checkIn.caption}</p>}
        {anonymize && <p>Someone spotted today&apos;s prompt here.</p>}
      </div>
    </aside>
  );
}
