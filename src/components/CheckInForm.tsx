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
type CameraPhase = "idle" | "live" | "preview";

export function CheckInForm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const capturingRef = useRef(false);
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [useDemoLocation, setUseDemoLocation] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const prompt = getTodaysPrompt();

  useEffect(() => {
    getDeviceId();
  }, []);

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
    setFile(null);
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

      // Encode the current frame to a JPEG Blob, then release the camera.
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
      const asFile = new File([compressed], "checkin.jpg", {
        type: "image/jpeg",
      });

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const url = URL.createObjectURL(asFile);
      previewUrlRef.current = url;
      setFile(asFile);
      setPreview(url);
      setPhase("preview");
      setStatus("idle");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Could not capture that photo. Try again.");
      void startCamera();
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }

  function retakePhoto() {
    void startCamera();
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
      setMessage(
        "Location unavailable — using downtown demo pin. You can still check in.",
      );
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
      clearPreview();
      setPhase("idle");
      setCaption("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Check-in failed.");
    }
  }

  return (
    <>
      <aside className="split-side">
        <div className="panel-kicker">today&apos;s prompt</div>
        <h1>
          Find <em>{prompt}</em>
        </h1>
        <p className="lede">
          Spot it in the world, take one photo, pin where you are. Opt-in only —
          whenever you notice it.
        </p>
        <p className="meta">
          Opens your camera to take one photo — no uploads.
        </p>
      </aside>

      <section className="split-main checkin-capture">
        <div
          className={`photo-stage${phase === "live" ? " photo-stage-live" : ""}`}
        >
          {phase === "preview" && preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Check-in preview" />
          ) : phase === "live" ? (
            <>
              <video
                ref={videoRef}
                className="photo-camera"
                playsInline
                muted
                autoPlay
              />
              {capturing ? (
                <div
                  className="camera-processing"
                  role="status"
                  aria-live="polite"
                >
                  Processing…
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
              disabled={startingCamera}
            >
              <span>
                {startingCamera
                  ? "Opening camera…"
                  : `Photo of today’s ${prompt}`}
              </span>
            </button>
          )}
        </div>

        {phase === "preview" && (
          <div className="photo-retake">
            <button type="button" className="btn ghost" onClick={retakePhoto}>
              Retake photo
            </button>
          </div>
        )}

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
            className="btn ghost"
            onClick={grabLocation}
            disabled={status === "uploading" || status === "locating" || capturing}
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
            disabled={
              !file || status === "uploading" || status === "locating" || capturing
            }
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
      </section>
    </>
  );
}
