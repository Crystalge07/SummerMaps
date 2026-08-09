/** Soft UI sounds from WAV assets in /public/sounds. */

const CLICK_SRC = "/sounds/click.wav";
const SHUTTER_SRC = "/sounds/shutter.wav";

let lastPlay = 0;
let clickTemplate: HTMLAudioElement | null = null;
let shutterTemplate: HTMLAudioElement | null = null;

function ensureTemplate(
  current: HTMLAudioElement | null,
  src: string,
  volume: number,
): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!current) {
    current = new Audio(src);
    current.preload = "auto";
    current.volume = volume;
  }
  return current;
}

function playFromTemplate(template: HTMLAudioElement | null): void {
  if (!template) return;
  try {
    const node = template.cloneNode(true) as HTMLAudioElement;
    node.volume = template.volume;
    void node.play().catch(() => {
      // Autoplay blocked until a user gesture — ignore.
    });
  } catch {
    // Unsupported — ignore.
  }
}

function ensureClickTemplate(): HTMLAudioElement | null {
  clickTemplate = ensureTemplate(clickTemplate, CLICK_SRC, 0.5);
  return clickTemplate;
}

function ensureShutterTemplate(): HTMLAudioElement | null {
  shutterTemplate = ensureTemplate(shutterTemplate, SHUTTER_SRC, 0.55);
  return shutterTemplate;
}

/** Plastic bubble click (mixkit) — safe to call from any press handler. */
export function playClickSound(): void {
  const now = performance.now();
  // Dedupe bubbling / double pointer+click on the same press.
  if (now - lastPlay < 40) return;
  lastPlay = now;
  playFromTemplate(ensureClickTemplate());
}

/** Vintage camera shutter (mixkit). */
export function playShutterSound(): void {
  playFromTemplate(ensureShutterTemplate());
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
  ensureClickTemplate();
  ensureShutterTemplate();

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
