"use client";

import { format } from "date-fns";
import { useState } from "react";
import { deleteCheckIn } from "@/lib/api";
import type { CheckIn } from "@/lib/types";

type Props = {
  checkIn: CheckIn;
  canDelete: boolean;
  onDeleted: (id: string) => void;
  selected?: boolean;
  onSelect?: (checkIn: CheckIn) => void;
};

export function CheckInCard({
  checkIn,
  canDelete,
  onDeleted,
  selected = false,
  onSelect,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function onConfirmDelete() {
    setDeleting(true);
    setError("");
    try {
      await deleteCheckIn(checkIn.id, checkIn.device_id);
      onDeleted(checkIn.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <article
      className={`checkin-card${selected ? " selected" : ""}`}
      onClick={() => onSelect?.(checkIn)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={checkIn.photo_url} alt="" className="checkin-card-photo" />
      <div className="checkin-card-body">
        <strong>{format(new Date(checkIn.created_at), "h:mm a")}</strong>
        {checkIn.location_name?.trim() ? (
          <p className="checkin-location">{checkIn.location_name.trim()}</p>
        ) : null}
        {checkIn.caption && <p>{checkIn.caption}</p>}
        {error && <p className="status error">{error}</p>}
        {confirming ? (
          <div className="checkin-card-confirm" onClick={(e) => e.stopPropagation()}>
            <span>Delete this capture?</span>
            <div className="actions">
              <button
                type="button"
                className="btn primary"
                disabled={deleting}
                onClick={onConfirmDelete}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={deleting}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {canDelete && !confirming && (
        <button
          type="button"
          className="checkin-card-delete"
          aria-label="Delete capture"
          title="Delete capture"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
        >
          <TrashIcon />
        </button>
      )}
    </article>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12zM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
