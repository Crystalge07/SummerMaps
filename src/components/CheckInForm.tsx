"use client";

import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  createCheckIn,
  storageMode,
  uploadCheckInPhoto,
} from "@/lib/api";
import { useAuthOptional } from "@/lib/auth";
import { getDeviceId } from "@/lib/device";
import { CITY_CENTER, getCurrentPosition } from "@/lib/geo";
import { getTodaysPrompt } from "@/lib/prompts";

type Status = "idle" | "locating" | "uploading" | "done" | "error";
type CameraPhase = "idle" | "live" | "preview";

export function CheckInForm() {
  const router = useRouter();
  const auth = useAuthOptional();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const capturingRef = useRef(false);
  const captionRef = useRef("");
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [startingCamera, setStartingCamera] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const prompt = getTodaysPrompt();

  useEffect(() => {
    getDeviceId();
  }, []);

  useEffect(() => {
    if (status !== "done") return;
    const timer = window.setTimeout(() => {
      router.push("/path");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [status, router]);

  useEffect(() => {
    captionRef.current = caption;
  }, [caption]);

  // Cleanup only touches refs so this effect stays dependency-free.
  useEffect(() => {
    return () => {
      const stream = streamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== "live" || capturing) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      setStatus("error");
      setMessage("Could not start the camera preview.");
    });
  }, [phase, capturing]);

  function stopCamera() {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function clearPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage("Camera is not supported in this browser.");
      return;
    }
    if (!window.isSecureContext) {
      setStatus("error");
      setMessage("Camera needs a secure connection (HTTPS or localhost).");
      return;
    }

    setStartingCamera(true);
    setStatus("idle");
    setMessage("");

    try {
      stopCamera();
      clearPreview();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
      });
      streamRef.current = stream;
      setPhase("live");
    } catch (err) {
      stopCamera();
      setPhase("idle");
      setStatus("error");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMessage("Camera permission denied. Allow camera access and try again.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setMessage("No camera found on this device.");
      } else {
        setMessage("Could not open the camera. Try again.");
      }
    } finally {
      setStartingCamera(false);
    }
  }

  async function pinCapture(file: File) {
    setStatus("locating");
    setMessage("Getting your place…");

    let position = CITY_CENTER;
    let demo = false;
    try {
      position = await getCurrentPosition();
    } catch {
      demo = true;
    }

    setStatus("uploading");
    setMessage(demo ? "Dropping your pin with a downtown demo place…" : "Dropping your pin…");

    const deviceId = getDeviceId();
    const photoUrl = await uploadCheckInPhoto(file, deviceId);
    await createCheckIn({
      device_id: deviceId,
      prompt,
      lat: position.lat,
      lng: position.lng,
      photo_url: photoUrl,
      caption: captionRef.current.trim() || null,
    });

    setStatus("done");
    setMessage(
      demo
        ? "Pin dropped! (demo place) Taking you to your path…"
        : "Pin dropped! Taking you to your path…",
    );
    setCaption("");
  }

  async function capturePhoto() {
    if (capturingRef.current) return;

    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setStatus("error");
      setMessage("Camera is not ready yet. Wait a moment and try again.");
      return;
    }

    capturingRef.current = true;
    setCapturing(true);
    setMessage("Processing photo…");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("Capture failed")),
          "image/jpeg",
          0.92,
        );
      });
      stopCamera();

      const rawFile = new File([blob], "capture.jpg", { type: "image/jpeg" });
      const compressed = await imageCompression(rawFile, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
      });
      const asFile = new File([compressed], "capture.jpg", {
        type: "image/jpeg",
      });

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const url = URL.createObjectURL(asFile);
      previewUrlRef.current = url;
      setPreview(url);
      setPhase("preview");

      await pinCapture(asFile);
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Could not capture that photo. Try again.",
      );
      // If we never reached preview, reopen the camera for another try.
      if (!previewUrlRef.current) {
        void startCamera();
      }
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }

  const busy =
    capturing || status === "locating" || status === "uploading";

  return (
    <div className="checkin-page">
      <header className="checkin-header">
        <div className="panel-kicker">today&apos;s prompt</div>
        <h1>
          Capture <em>{prompt}</em>
        </h1>
        <p className="lede">
          Spot it in the world, take one photo — we grab your place and pin it
          to the map. Opt-in only, whenever you notice it.
        </p>
        <p className="meta">
          Opens your camera for one photo — no uploads from your library.
        </p>
      </header>

      <div
        className={`photo-stage${phase === "live" ? " photo-stage-live" : ""}`}
      >
        {phase === "preview" && preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Capture preview" />
        ) : phase === "live" ? (
          <>
            <video
              ref={videoRef}
              className="photo-camera"
              playsInline
              muted
              autoPlay
            />
            {busy ? (
              <div
                className="camera-processing"
                role="status"
                aria-live="polite"
              >
                {status === "locating"
                  ? "Getting place…"
                  : status === "uploading"
                    ? "Pinning…"
                    : "Processing…"}
              </div>
            ) : (
              <div className="camera-chrome">
                <button
                  type="button"
                  className="camera-cancel"
                  onClick={() => {
                    stopCamera();
                    setPhase("idle");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="camera-shutter"
                  aria-label="Take photo"
                  onClick={() => void capturePhoto()}
                >
                  <span className="camera-shutter-inner" />
                </button>
                <span className="camera-chrome-spacer" aria-hidden="true" />
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            className="photo-placeholder"
            onClick={() => void startCamera()}
            disabled={startingCamera || busy}
          >
            <CameraIcon />
            <span>
              {startingCamera ? "Opening camera…" : "tap to spot something"}
            </span>
          </button>
        )}
      </div>

      {status !== "done" && (
        <label className="field checkin-caption">
          <span className="sr-only">Caption (optional)</span>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="where did you spot it?"
            maxLength={120}
            disabled={busy}
          />
        </label>
      )}

      {status === "done" && (
        <p className="status checkin-status" role="status" aria-live="polite">
          Spotted! Taking you to your path…
        </p>
      )}

      {message && status !== "done" && (
        <p
          className={`status checkin-status ${status === "error" ? "error" : ""}`}
        >
          {message}
        </p>
      )}

      <p className="checkin-footer">
        saving to your path ·{" "}
        {storageMode() === "supabase" ? "synced" : "local demo"}
        {auth?.profile ? ` · @${auth.profile.username}` : ""}
      </p>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      className="photo-placeholder-icon"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="14"
        width="38"
        height="26"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M17 14l2.6-4.5A3 3 0 0 1 22.2 8h3.6a3 3 0 0 1 2.6 1.5L31 14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="27" r="7.5" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
