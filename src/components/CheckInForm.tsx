"use client";

import imageCompression from "browser-image-compression";
import { useEffect, useRef, useState } from "react";
import {
  createCheckIn,
  storageMode,
  uploadCheckInPhoto,
} from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { CITY_CENTER, getCurrentPosition } from "@/lib/geo";
import { getTodaysPrompt } from "@/lib/prompts";

type Status = "idle" | "locating" | "uploading" | "done" | "error";

export function CheckInForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [useDemoLocation, setUseDemoLocation] = useState(false);
  const prompt = getTodaysPrompt();

  useEffect(() => {
    getDeviceId();
  }, []);

  async function onFileChange(selected: File | null) {
    if (!selected) return;
    const compressed = await imageCompression(selected, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    const asFile = new File([compressed], "checkin.jpg", {
      type: "image/jpeg",
    });
    setFile(asFile);
    setPreview(URL.createObjectURL(asFile));
  }

  async function grabLocation() {
    setStatus("locating");
    setMessage("Getting your place…");
    try {
      const pos = await getCurrentPosition();
      setCoords(pos);
      setUseDemoLocation(false);
      setStatus("idle");
      setMessage("");
    } catch {
      setCoords(CITY_CENTER);
      setUseDemoLocation(true);
      setStatus("idle");
      setMessage("Location unavailable — using downtown demo pin. You can still check in.");
    }
  }

  async function submit() {
    if (!file) {
      setStatus("error");
      setMessage("A photo is required for every check-in.");
      return;
    }

    setStatus("uploading");
    setMessage("Saving your find…");

    try {
      let position = coords;
      if (!position) {
        try {
          position = await getCurrentPosition();
        } catch {
          position = CITY_CENTER;
          setUseDemoLocation(true);
        }
      }

      const deviceId = getDeviceId();
      const photoUrl = await uploadCheckInPhoto(file, deviceId);
      await createCheckIn({
        device_id: deviceId,
        prompt,
        lat: position.lat,
        lng: position.lng,
        photo_url: photoUrl,
        caption: caption.trim() || null,
      });

      setStatus("done");
      setMessage("Pinned. Your path just grew.");
      setFile(null);
      setPreview(null);
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Check-in failed.");
    }
  }

  return (
    <div className="panel checkin-panel">
      <div className="panel-kicker">Today&apos;s prompt</div>
      <h1>
        Find <em>{prompt}</em>
      </h1>
      <p className="lede">
        Spot it in the world, take one photo, pin where you are. Opt-in only —
        whenever you notice it.
      </p>

      <div className="photo-stage">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Check-in preview" />
        ) : (
          <button
            type="button"
            className="photo-placeholder"
            onClick={() => inputRef.current?.click()}
          >
            <span>Photo of today&apos;s {prompt}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />

      <label className="field">
        <span>Caption (optional)</span>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Where did you spot it?"
          maxLength={120}
        />
      </label>

      <div className="actions">
        <button
          type="button"
          className="btn primary"
          onClick={grabLocation}
          disabled={status === "uploading" || status === "locating"}
        >
          {status === "locating"
            ? "Getting place…"
            : coords
              ? useDemoLocation
                ? "Demo pin set"
                : "Location locked"
              : "Grab location"}
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={submit}
          disabled={!file || status === "uploading" || status === "locating"}
        >
          {status === "uploading" ? "Saving…" : "Pin it"}
        </button>
      </div>

      {message && (
        <p className={`status ${status === "error" ? "error" : ""}`}>
          {message}
        </p>
      )}

      <p className="meta">
        Storage: {storageMode() === "supabase" ? "Supabase" : "local demo"}
      </p>
    </div>
  );
}
