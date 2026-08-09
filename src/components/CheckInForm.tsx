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
import {
  GeoError,
  getCurrentPosition,
  isSafariBrowser,
  queryGeolocationPermission,
  STACKT_MARKET,
  STACKT_MARKET_NAME,
  type Coords,
  type GeoPermission,
} from "@/lib/geo";
import { getTodaysPrompt } from "@/lib/prompts";

type Status = "idle" | "locating" | "located" | "uploading" | "done" | "error";
type CameraPhase = "idle" | "live" | "preview";

export function CheckInForm() {
  const router = useRouter();
  const auth = useAuthOptional();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const capturedFileRef = useRef<File | null>(null);
  const capturingRef = useRef(false);
  const captionRef = useRef("");
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [startingCamera, setStartingCamera] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [spottedAt, setSpottedAt] = useState<string | null>(null);
  const [geoPermission, setGeoPermission] =
    useState<GeoPermission>("unknown");
  const [showHowTo, setShowHowTo] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const prompt = getTodaysPrompt();

  // Only block UI messaging for explicit denial — never for prompt/unknown (Safari).
  const locationDenied = geoPermission === "denied";
  const [isSafari] = useState(() => isSafariBrowser());

  useEffect(() => {
    getDeviceId();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;
    const onChange = () => {
      if (
        permissionStatus?.state === "granted" ||
        permissionStatus?.state === "denied" ||
        permissionStatus?.state === "prompt"
      ) {
        setGeoPermission(permissionStatus.state);
      }
    };

    void (async () => {
      const state = await queryGeolocationPermission();
      if (!cancelled) setGeoPermission(state);

      try {
        if (!navigator.permissions?.query) return;
        permissionStatus = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        if (cancelled) return;
        permissionStatus.addEventListener("change", onChange);
      } catch {
        // Safari / unsupported — leave as unknown until getCurrentPosition.
      }
    })();

    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener("change", onChange);
    };
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
    capturedFileRef.current = null;
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
    setLocationStatus("");

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

  async function resolvePosition(): Promise<{
    position: Coords;
    locationName: string;
  }> {
    setStatus("locating");
    setLocationStatus("📍 Finding your location…");
    setMessage("");

    const position = await getCurrentPosition({ timeoutMs: 15000 });
    // Refresh permission state after a successful prompt/grant.
    void queryGeolocationPermission().then(setGeoPermission);

    const locationName = await reverseGeocodeWithTimeout(
      position.lat,
      position.lng,
    );
    const label = locationName.trim() || "Location found";
    setLocationStatus(`📍 ${label}`);
    setStatus("located");
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1000);
    });
    return { position, locationName };
  }

  async function pinCapture(file: File) {
    let position: Coords;
    let locationName = "";
    let usedFallback = false;

    try {
      const resolved = await resolvePosition();
      position = resolved.position;
      locationName = resolved.locationName;
    } catch (firstErr) {
      if (firstErr instanceof GeoError && firstErr.code === "denied") {
        setGeoPermission("denied");
      }
      try {
        const resolved = await resolvePosition();
        position = resolved.position;
        locationName = resolved.locationName;
      } catch (secondErr) {
        if (secondErr instanceof GeoError && secondErr.code === "denied") {
          setGeoPermission("denied");
        }
        position = STACKT_MARKET;
        locationName = STACKT_MARKET_NAME;
        usedFallback = true;
      }
    }

    setStatus("uploading");
    setLocationStatus("");
    setMessage("Dropping your pin…");

    const deviceId = getDeviceId();
    const photoUrl = await uploadCheckInPhoto(file, deviceId);
    await createCheckIn({
      device_id: deviceId,
      prompt,
      lat: position.lat,
      lng: position.lng,
      photo_url: photoUrl,
      caption: captionRef.current.trim() || null,
      location_name: locationName || null,
    });

    // Don't surface STACKT in the success flash — store the name on the pin only.
    setSpottedAt(usedFallback ? null : locationName || null);
    setStatus("done");
    setMessage("Pin dropped! Taking you to your path…");
    setCaption("");
    capturedFileRef.current = null;
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
      capturedFileRef.current = asFile;
      setPreview(url);
      setPhase("preview");
      setStatus("idle");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Could not capture that photo. Try again.",
      );
      if (!previewUrlRef.current) {
        void startCamera();
      }
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }

  function retakePhoto() {
    if (status === "locating" || status === "located" || status === "uploading") {
      return;
    }
    clearPreview();
    setStatus("idle");
    setMessage("");
    setLocationStatus("");
    void startCamera();
  }

  async function postCapture() {
    const file = capturedFileRef.current;
    if (!file) {
      setStatus("error");
      setMessage("No photo to post. Retake and try again.");
      return;
    }
    try {
      await pinCapture(file);
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Could not post that photo. Try again.",
      );
    }
  }

  const posting =
    status === "locating" || status === "located" || status === "uploading";
  const busy = capturing || posting;

  return (
    <div className="checkin-page">
      <header className="checkin-header">
        <div className="panel-kicker">today&apos;s prompt</div>
        <h1>
          Capture <em>{prompt}</em>
        </h1>
        <p className="lede">
          Capture the little joys in life, share it with the world
        </p>
      </header>

      {locationDenied && (
        <div className="checkin-geo-banner" role="status">
          <p>
            📍 Location access is off. Enable it in your browser settings for a
            more accurate pin.
          </p>
          <button
            type="button"
            className="checkin-geo-howto-toggle"
            onClick={() => setShowHowTo((v) => !v)}
            aria-expanded={showHowTo}
          >
            How to enable
          </button>
          {showHowTo && (
            <div className="checkin-geo-howto">
              {isSafari ? (
                <>
                  <p>To enable location in Safari:</p>
                  <p>1. Tap the &apos;AA&apos; or lock icon in the address bar</p>
                  <p>2. Tap &apos;Website Settings&apos;</p>
                  <p>3. Set Location to &apos;Allow&apos;</p>
                  <p>Then refresh the page and try again.</p>
                </>
              ) : (
                <p>
                  <strong>Chrome:</strong> tap the lock icon → Location → Allow
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className={`photo-stage${
          phase === "live" || phase === "preview" ? " photo-stage-live" : ""
        }`}
      >
        {phase === "preview" && preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Capture preview" />
            {posting ? (
              <div
                className="camera-processing"
                role="status"
                aria-live="polite"
              >
                {status === "uploading" ? "Pinning…" : "Finding place…"}
              </div>
            ) : (
              <div className="camera-chrome">
                <button
                  type="button"
                  className="camera-cancel"
                  onClick={retakePhoto}
                >
                  Retake
                </button>
                <span className="camera-chrome-spacer" aria-hidden="true" />
                <button
                  type="button"
                  className="camera-post"
                  onClick={() => void postCapture()}
                >
                  Post
                </button>
              </div>
            )}
          </>
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
            disabled={startingCamera || busy}
          >
            <CameraIcon />
            <span>
              {startingCamera ? "Opening camera…" : "Capture a moment now"}
            </span>
          </button>
        )}
      </div>

      {(status === "locating" || status === "located") && locationStatus && (
        <p
          className={`checkin-location-status${
            status === "locating" ? " pulse" : ""
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="checkin-location-dot" aria-hidden="true" />
          {locationStatus}
        </p>
      )}

      {status !== "done" && (
        <label className="field checkin-caption">
          <span className="sr-only">Notes</span>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Notes"
            maxLength={120}
            disabled={busy}
          />
        </label>
      )}

      {status === "done" && (
        <div className="checkin-status" role="status" aria-live="polite">
          <p className="status">
            {message || "Pin dropped! Taking you to your path…"}
          </p>
          {spottedAt ? (
            <p className="checkin-spotted-at">spotted at {spottedAt}</p>
          ) : null}
        </div>
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

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return "";
    const res = await fetch(
      `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${token}&types=neighborhood,locality,place&limit=1`,
    );
    if (!res.ok) return "";
    const data = (await res.json()) as {
      features?: Array<{
        properties?: { name?: string; place_formatted?: string };
      }>;
    };
    const feature = data.features?.[0];
    if (!feature) return "";
    return (
      feature.properties?.name ||
      feature.properties?.place_formatted ||
      ""
    );
  } catch {
    return "";
  }
}

async function reverseGeocodeWithTimeout(
  lat: number,
  lng: number,
  ms = 3000,
): Promise<string> {
  return Promise.race([
    reverseGeocode(lat, lng),
    new Promise<string>((resolve) => {
      window.setTimeout(() => resolve(""), ms);
    }),
  ]);
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
