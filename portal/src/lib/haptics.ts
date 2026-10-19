/**
 * Haptic feedback for the lesson player (wrong answers, risky simulation steps).
 * The preference is per device, as the original's Profile → "Vibration" copy says
 * ("This device…"), so it lives in localStorage; default on when the device can vibrate.
 */
const KEY = "cy-haptics";

export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function hapticsEnabled(): boolean {
  if (!hapticsSupported()) return false;
  try {
    return window.localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}

/** Short pulse pattern; silently does nothing when unsupported or switched off. */
export function vibrate(pattern: number | number[] = 40): void {
  if (!hapticsEnabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw without a user gesture */
  }
}
