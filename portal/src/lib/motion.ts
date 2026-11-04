import { useSyncExternalStore } from "react";

export type Motion = "full" | "calm" | "still";

const REDUCED = "(prefers-reduced-motion: reduce)";

/** The OS reduced-motion setting counts as Still; anything unknown on <html data-motion> as Full. */
export function motionLevel(dataMotion: string | undefined, reducedMotion: boolean): Motion {
  if (reducedMotion || dataMotion === "still") return "still";
  return dataMotion === "calm" ? "calm" : "full";
}

/** The viewer's motion level now, for event handlers and effects (browser only). */
export function readMotion(): Motion {
  return motionLevel(document.documentElement.dataset.motion, window.matchMedia(REDUCED).matches);
}

// The motion pickers (Profile, the player) set data-motion on <html> at once, before the server round-trip.
function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mq.removeEventListener("change", onChange);
    mo.disconnect();
  };
}

/**
 * Full, Calm or Still, live. The server render (and hydration) assumes Full, as the mascot does; the CSS
 * rules in globals.css already hold still and calm back until the client snapshot takes over.
 */
export function useMotion(): Motion {
  return useSyncExternalStore(subscribeMotion, readMotion, () => "full");
}
