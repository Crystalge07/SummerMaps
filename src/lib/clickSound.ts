/** Soft UI sounds via Web Audio — no asset files; unlocked by the first tap. */

let ctx: AudioContext | null = null;
let lastPlay = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function resumeCtx(audio: AudioContext): void {
  if (audio.state === "suspended") void audio.resume();
}

/** Quiet, short “tick” — safe to call from any press handler. */
export function playClickSound(): void {
  const now = performance.now();
  // Dedupe bubbling / double pointer+click on the same press.
  if (now - lastPlay < 40) return;
  lastPlay = now;

  try {
    const audio = getCtx();
    if (!audio) return;
    resumeCtx(audio);

    const t0 = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(2200, t0);
    osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.035);

    // Very soft attack/decay so it reads as a click, not a beep.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.055, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.048);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.055);
  } catch {
    // Autoplay / unsupported — ignore.
  }
}

/** Soft camera shutter — two quick layers (blade + body). */
export function playShutterSound(): void {
  try {
    const audio = getCtx();
    if (!audio) return;
    resumeCtx(audio);

    const t0 = audio.currentTime;

    // Sharp blade flick
    const blade = audio.createOscillator();
    const bladeGain = audio.createGain();
    blade.type = "triangle";
    blade.frequency.setValueAtTime(1400, t0);
    blade.frequency.exponentialRampToValueAtTime(280, t0 + 0.05);
    bladeGain.gain.setValueAtTime(0.0001, t0);
    bladeGain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.003);
    bladeGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    blade.connect(bladeGain);
    bladeGain.connect(audio.destination);
    blade.start(t0);
    blade.stop(t0 + 0.08);

    // Soft body thud a hair later
    const body = audio.createOscillator();
    const bodyGain = audio.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(180, t0 + 0.018);
    body.frequency.exponentialRampToValueAtTime(70, t0 + 0.1);
    bodyGain.gain.setValueAtTime(0.0001, t0 + 0.018);
    bodyGain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.025);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    body.connect(bodyGain);
    bodyGain.connect(audio.destination);
    body.start(t0 + 0.018);
    body.stop(t0 + 0.13);
  } catch {
    // Autoplay / unsupported — ignore.
  }
}

function isPressable(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.closest("[data-no-click-sound]")) return false;
  // Shutter uses playShutterSound instead of the generic click.
  if (el.closest(".camera-shutter")) return false;

  const target = el.closest(
    'button, [role="button"], a.btn, .btn, .tab-item, .camera-post, .camera-cancel, .map-paths-toggle, .see-all-btn, input[type="submit"], input[type="button"]',
  );
  if (!target || !(target instanceof HTMLElement)) return false;

  if (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) {
    if (target.disabled) return false;
  }
  if (target.getAttribute("aria-disabled") === "true") return false;
  return true;
}

/** Global listener — call once from a client root. */
export function installClickSounds(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const el = event.target;
    if (!(el instanceof Element)) return;
    if (!isPressable(el)) return;
    playClickSound();
  };

  document.addEventListener("pointerdown", onPointerDown, {
    capture: true,
    passive: true,
  });

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
  };
}
