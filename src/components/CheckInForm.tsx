"use client";

import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import {
  createCheckIn,
  storageMode,
  uploadCheckInPhoto,
} from "@/lib/api";
import { useAuthOptional } from "@/lib/auth";
import { playShutterSound } from "@/lib/clickSound";
import { getDeviceId } from "@/lib/device";
import {
  getCurrentPosition,
  STACKT_MARKET,
  STACKT_MARKET_NAME,
  type Coords,
} from "@/lib/geo";
import { getTodaysPrompt } from "@/lib/prompts";

type Status = "idle" | "locating" | "located" | "uploading" | "done" | "error";
type CameraPhase = "idle" | "live" | "preview";
type FacingMode = "environment" | "user";

type ZoomCapability = { min: number; max: number; step?: number };

function readZoomCapability(track: MediaStreamTrack): ZoomCapability | null {
  const caps = track.getCapabilities() as MediaTrackCapabilities & {
    zoom?: ZoomCapability | number;
  };
  const z = caps.zoom;
  if (!z || typeof z === "number") return null;
  if (!(z.max > z.min)) return null;
  return z;
}

export function CheckInForm() {
  const router = useRouter();
  const auth = useAuthOptional();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const capturedFileRef = useRef<File | null>(null);
  const capturingRef = useRef(false);
  const postingRef = useRef(false);
  const captionRef = useRef("");
  const facingModeRef = useRef<FacingMode>("environment");
  const zoomRef = useRef(1);
  const zoomMinRef = useRef(1);
  const zoomMaxRef = useRef(1);
  const hwZoomRef = useRef(false);
  const touchCameraRef = useRef(false);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(
    null,
  );
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [startingCamera, setStartingCamera] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [spottedAt, setSpottedAt] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [zoom, setZoom] = useState(1);
  const [zoomMin, setZoomMin] = useState(1);
  const [zoomMax, setZoomMax] = useState(1);
  const [hwZoom, setHwZoom] = useState(false);
  const [touchCamera, setTouchCamera] = useState(false);
  const [canFlip, setCanFlip] = useState(false);
  const prompt = getTodaysPrompt();

  facingModeRef.current = facingMode;
  zoomRef.current = zoom;
  zoomMinRef.current = zoomMin;
  zoomMaxRef.current = zoomMax;
  hwZoomRef.current = hwZoom;

  useEffect(() => {
    getDeviceId();
    const touch =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 1;
    touchCameraRef.current = touch;
    setTouchCamera(touch);
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

  function syncZoomForFacing(facing: FacingMode, track: MediaStreamTrack | null) {
    // Zoom is phone-only (pinch). Laptops never get a zoom range.
    if (!touchCameraRef.current || facing === "user") {
      setHwZoom(false);
      hwZoomRef.current = false;
      setZoomMin(1);
      setZoomMax(1);
      zoomMinRef.current = 1;
      zoomMaxRef.current = 1;
      setZoom(1);
      zoomRef.current = 1;
      return;
    }

    const caps = track ? readZoomCapability(track) : null;
    if (caps) {
      setHwZoom(true);
      hwZoomRef.current = true;
      setZoomMin(caps.min);
      setZoomMax(caps.max);
      zoomMinRef.current = caps.min;
      zoomMaxRef.current = caps.max;
      setZoom(caps.min);
      zoomRef.current = caps.min;
      return;
    }

    // Digital zoom fallback for mobile back camera.
    setHwZoom(false);
    hwZoomRef.current = false;
    setZoomMin(1);
    setZoomMax(4);
    zoomMinRef.current = 1;
    zoomMaxRef.current = 4;
    setZoom(1);
    zoomRef.current = 1;
  }

  async function refreshCanFlip() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      setCanFlip(cams.length >= 2);
    } catch {
      setCanFlip(false);
    }
  }

  async function applyZoom(next: number) {
    if (!touchCameraRef.current) return;
    if (facingModeRef.current !== "environment") return;
    const min = zoomMinRef.current;
    const max = zoomMaxRef.current;
    if (!(max > min)) return;
    const value = Math.min(max, Math.max(min, next));
    setZoom(value);
    zoomRef.current = value;
    if (!hwZoomRef.current) return;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: value } as unknown as MediaTrackConstraintSet],
      });
    } catch {
      // Some browsers advertise zoom but reject applyConstraints.
    }
  }

  function pinchDistance(touches: React.TouchList) {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function onCameraTouchStart(e: TouchEvent) {
    if (!touchCameraRef.current) return;
    if (facingModeRef.current !== "environment") return;
    if (!(zoomMaxRef.current > zoomMinRef.current)) return;
    if (e.touches.length !== 2) {
      pinchRef.current = null;
      return;
    }
    pinchRef.current = {
      startDist: pinchDistance(e.touches),
      startZoom: zoomRef.current,
    };
  }

  function onCameraTouchMove(e: TouchEvent) {
    if (!pinchRef.current || e.touches.length !== 2) return;
    e.preventDefault();
    const dist = pinchDistance(e.touches);
    if (pinchRef.current.startDist <= 0) return;
    const next =
      pinchRef.current.startZoom * (dist / pinchRef.current.startDist);
    void applyZoom(next);
  }

  function onCameraTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  async function startCamera(nextFacing?: FacingMode) {
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

    const facing = nextFacing ?? facingModeRef.current;
    setFacingMode(facing);
    facingModeRef.current = facing;
    setStartingCamera(true);
    setStatus("idle");
    setMessage("");
    setLocationStatus("");

    try {
      stopCamera();
      if (phase !== "live") {
        clearPreview();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0] ?? null;
      const settingsFacing = track?.getSettings?.().facingMode;
      if (settingsFacing === "user" || settingsFacing === "environment") {
        setFacingMode(settingsFacing);
        facingModeRef.current = settingsFacing;
        syncZoomForFacing(settingsFacing, track);
      } else {
        syncZoomForFacing(facing, track);
      }
      if (
        facingModeRef.current === "environment" &&
        track &&
        hwZoomRef.current
      ) {
        try {
          await track.applyConstraints({
            advanced: [
              { zoom: zoomRef.current } as unknown as MediaTrackConstraintSet,
            ],
          });
        } catch {
          // ignore
        }
      }
      setPhase("live");
      void refreshCanFlip();
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

  async function flipCamera() {
    if (capturingRef.current || startingCamera || phase !== "live") return;
    if (!canFlip) return;

    const prevFacing = facingModeRef.current;
    const next: FacingMode =
      prevFacing === "environment" ? "user" : "environment";
    const previousStream = streamRef.current;
    setStartingCamera(true);
    setMessage("");

    try {
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { exact: next },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: next },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
        });
      }

      const track = newStream.getVideoTracks()[0] ?? null;
      const settingsFacing = track?.getSettings?.().facingMode;
      // If the device ignored the request and gave the same facing, abort.
      if (
        settingsFacing &&
        (settingsFacing === "user" || settingsFacing === "environment") &&
        settingsFacing === prevFacing
      ) {
        for (const t of newStream.getTracks()) t.stop();
        setMessage("This device only has one camera.");
        setCanFlip(false);
        return;
      }

      streamRef.current = newStream;
      if (previousStream) {
        for (const t of previousStream.getTracks()) t.stop();
      }
      const appliedFacing: FacingMode =
        settingsFacing === "user" || settingsFacing === "environment"
          ? settingsFacing
          : next;
      setFacingMode(appliedFacing);
      facingModeRef.current = appliedFacing;
      syncZoomForFacing(appliedFacing, track);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        void videoRef.current.play().catch(() => {
          setMessage("Could not start the camera preview.");
        });
      }
      void refreshCanFlip();
    } catch {
      // Keep the existing stream attached — never leave a black preview.
      if (previousStream && videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = previousStream;
        void videoRef.current.play().catch(() => {});
      }
      streamRef.current = previousStream;
      setFacingMode(prevFacing);
      facingModeRef.current = prevFacing;
      setMessage("Couldn't switch cameras on this device.");
      void refreshCanFlip();
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
    } catch {
      // One silent retry, then pin at STACKT — never surface location errors.
      try {
        const resolved = await resolvePosition();
        position = resolved.position;
        locationName = resolved.locationName;
      } catch {
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
    clearPreview();
    setPhase("idle");
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
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const selfie = facingModeRef.current === "user";
      const useDigitalZoom =
        touchCameraRef.current &&
        !selfie &&
        !hwZoomRef.current &&
        zoomRef.current > 1;
      const z = useDigitalZoom ? zoomRef.current : 1;
      const sw = vw / z;
      const sh = vh / z;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      if (selfie) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      playShutterSound();

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
    if (postingRef.current) return;
    const file = capturedFileRef.current;
    if (!file) {
      setStatus("error");
      setMessage("No photo to post. Retake and try again.");
      return;
    }
    postingRef.current = true;
    try {
      await pinCapture(file);
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Could not post that photo. Try again.",
      );
    } finally {
      postingRef.current = false;
    }
  }

  const posting =
    status === "locating" ||
    status === "located" ||
    status === "uploading" ||
    status === "done";
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
            <div
              className={`camera-viewport${
                touchCamera &&
                facingMode === "environment" &&
                zoomMax > zoomMin
                  ? " camera-viewport-pinchable"
                  : ""
              }`}
              onTouchStart={onCameraTouchStart}
              onTouchMove={onCameraTouchMove}
              onTouchEnd={onCameraTouchEnd}
              onTouchCancel={onCameraTouchEnd}
            >
              <video
                ref={videoRef}
                className={`photo-camera${
                  facingMode === "user" ? " photo-camera-selfie" : ""
                }${
                  touchCamera &&
                  facingMode === "environment" &&
                  !hwZoom &&
                  zoom > 1
                    ? " photo-camera-zoomed"
                    : ""
                }`}
                style={
                  touchCamera &&
                  facingMode === "environment" &&
                  !hwZoom &&
                  zoom > 1
                    ? { transform: `scale(${zoom})` }
                    : undefined
                }
                playsInline
                muted
                autoPlay
              />
            </div>
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
                {canFlip ? (
                  <button
                    type="button"
                    className="camera-flip"
                    aria-label={
                      facingMode === "environment"
                        ? "Switch to front camera"
                        : "Switch to back camera"
                    }
                    disabled={startingCamera}
                    onClick={() => void flipCamera()}
                  >
                    Flip
                  </button>
                ) : (
                  <span className="camera-chrome-spacer" aria-hidden="true" />
                )}
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
