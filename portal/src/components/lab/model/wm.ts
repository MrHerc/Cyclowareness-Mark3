import type { AppId } from "./labs";

/**
 * The virtual machine's window manager as a pure reducer: which app windows are open, minimised or
 * maximised, their stacking order and position. The desktop and the phone layout read the same state:
 * on a phone the focused window is the one full-screen app.
 */

/** `moved` is false until the learner drags the window: until then it is placed to fit the desktop. */
export type Win = { open: boolean; min: boolean; max: boolean; moved: boolean; x: number; y: number; z: number };
export type WmState = { wins: Record<AppId, Win>; top: number; focus: AppId | null };
export type WmAction =
  | { type: "open" | "close" | "minimise" | "focus" | "toggleMax" | "taskbar"; app: AppId }
  | { type: "move"; app: AppId; x: number; y: number }
  | { type: "home" };

export const APP_ORDER: readonly AppId[] = ["mail", "browser", "terminal", "files"];
/** Default window size per app, shrunk to the desktop when it is smaller. */
export const APP_SIZE: Record<AppId, { w: number; h: number }> = {
  mail: { w: 700, h: 440 },
  browser: { w: 700, h: 450 },
  terminal: { w: 640, h: 380 },
  files: { w: 560, h: 360 },
};

const closed = (i: number): Win => ({ open: false, min: false, max: false, moved: false, x: 92 + i * 26, y: 14 + i * 22, z: 0 });

export function initialWm(openApp?: AppId): WmState {
  const wins = Object.fromEntries(APP_ORDER.map((a, i) => [a, closed(i)])) as Record<AppId, Win>;
  const s: WmState = { wins, top: 0, focus: null };
  return openApp ? wmReducer(s, { type: "open", app: openApp }) : s;
}

/** The visible window with the highest z, the one that takes focus when the focused window goes away. */
function nextFocus(wins: Record<AppId, Win>, except: AppId): AppId | null {
  let best: AppId | null = null;
  for (const a of APP_ORDER) {
    const w = wins[a];
    if (a === except || !w.open || w.min) continue;
    if (!best || w.z > wins[best].z) best = a;
  }
  return best;
}

export function wmReducer(s: WmState, action: WmAction): WmState {
  if (action.type === "home") {
    const wins = { ...s.wins };
    for (const a of APP_ORDER) if (wins[a].open) wins[a] = { ...wins[a], min: true };
    return { ...s, wins, focus: null };
  }
  const { app } = action;
  const w = s.wins[app];
  const raise = (patch: Partial<Win>): WmState => ({ wins: { ...s.wins, [app]: { ...w, ...patch, z: s.top + 1 } }, top: s.top + 1, focus: app });
  switch (action.type) {
    case "open":
    case "focus":
      if (action.type === "focus" && !w.open) return s;
      if (s.focus === app && w.open && !w.min) return s;
      return raise({ open: true, min: false });
    case "close": {
      const wins = { ...s.wins, [app]: { ...w, open: false, min: false, max: false } };
      return { ...s, wins, focus: s.focus === app ? nextFocus(wins, app) : s.focus };
    }
    case "minimise": {
      if (!w.open) return s;
      const wins = { ...s.wins, [app]: { ...w, min: true } };
      return { ...s, wins, focus: s.focus === app ? nextFocus(wins, app) : s.focus };
    }
    case "toggleMax":
      return w.open ? raise({ max: !w.max, min: false }) : s;
    case "taskbar":
      // Like a real taskbar: open a closed app, restore a minimised one, minimise the focused one.
      if (!w.open || w.min) return raise({ open: true, min: false });
      return s.focus === app ? wmReducer(s, { type: "minimise", app }) : raise({});
    case "move":
      return w.open ? { ...s, wins: { ...s.wins, [app]: { ...w, moved: true, x: Math.round(action.x), y: Math.round(action.y) } } } : s;
  }
}

/** Where a window that was never dragged sits: its default spot, pulled in so the whole window fits the desktop. */
export function fitWindow(x: number, y: number, w: number, h: number, dw: number, dh: number): { x: number; y: number } {
  return { x: Math.max(8, Math.min(x, dw - w - 8)), y: Math.max(8, Math.min(y, dh - h - 8)) };
}

/** Keeps a dragged window of width w inside a desktop of size dw×dh, with its title bar always reachable. */
export function clampWindow(x: number, y: number, w: number, dw: number, dh: number): { x: number; y: number } {
  const minVisible = 96;
  return { x: Math.min(Math.max(x, minVisible - w), Math.max(0, dw - minVisible)), y: Math.min(Math.max(y, 0), Math.max(0, dh - 40)) };
}
