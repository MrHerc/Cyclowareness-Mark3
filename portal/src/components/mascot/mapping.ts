/**
 * Rive state machine input values. The order follows the animation list in the mascot file
 * (docs/audit/06-lesson-engine.md §3), verified against mascot.riv's animation list in the browser on 2026-10-19 (moods, topics and gestures; point-down precedes point-up).
 */
export type MascotMood = "idle" | "talk" | "happy" | "think" | "alert" | "sad" | "celebrate" | "surprised" | "proud" | "curious" | "worried" | "excited" | "sleepy" | "laughing";

export const MOOD_INDEX: Record<MascotMood, number> = {
  idle: 0,
  talk: 1,
  happy: 2,
  think: 3,
  alert: 4,
  sad: 5,
  celebrate: 6,
  surprised: 7,
  proud: 8,
  curious: 9,
  worried: 10,
  excited: 11,
  sleepy: 12,
  laughing: 13,
};

export type MascotGesture =
  | "rest"
  | "point-left"
  | "point-right"
  | "point-up"
  | "point-down"
  | "wave"
  | "nod"
  | "shake"
  | "cheer"
  | "shrug"
  | "lean-in"
  | "shield-up"
  | "inspect"
  | "lecture"
  | "eureka"
  | "reassure"
  | "toss"
  | "bow"
  | "attention"
  | "recite"
  | "hop"
  | "facepalm"
  | "count"
  | "explain"
  | "tap-left"
  | "tap-right"
  | "ponder"
  | "present";

export const GESTURE_INDEX: Record<MascotGesture, number> = {
  rest: 0,
  "point-left": 1,
  "point-right": 2,
  "point-down": 3,
  "point-up": 4,
  wave: 5,
  nod: 6,
  shake: 7,
  cheer: 8,
  shrug: 9,
  "lean-in": 10,
  "shield-up": 11,
  inspect: 12,
  lecture: 13,
  eureka: 14,
  reassure: 15,
  toss: 16,
  bow: 17,
  attention: 18,
  recite: 19,
  hop: 20,
  facepalm: 21,
  count: 22,
  explain: 23,
  "tap-left": 24,
  "tap-right": 25,
  ponder: 26,
  present: 27,
};

export type MascotTopic = "none" | "email" | "identity" | "social" | "devices" | "data" | "physical" | "incident" | "ai-threats" | "work";

export const TOPIC_INDEX: Record<MascotTopic, number> = {
  none: 0,
  email: 1,
  identity: 2,
  social: 3,
  devices: 4,
  data: 5,
  physical: 6,
  incident: 7,
  "ai-threats": 8,
  work: 9,
};

/*
 * The tables below are inferred from the animation order in mascot.riv (not verified in the browser):
 * act_rest, act_nap_in/act_nap_loop/act_nap_wake, act_apple, act_read; poke_rest, poke_head, poke_face,
 * poke_body, poke_antenna; guide_travel_l, guide_travel_r; aim_R… (right hand), aim_L… (left hand).
 */

/** idleAct values: 0 rest, 1 nap (in/loop; the "wake" trigger ends it), 2 apple, 3 read (inferred). */
export type MascotAct = "rest" | "nap" | "apple" | "read";

export const ACT_INDEX: Record<MascotAct, number> = {
  rest: 0,
  nap: 1,
  apple: 2,
  read: 3,
};

/** pokeZone values, in the order of the poke_* animations (inferred). */
export type MascotPokeZone = "rest" | "head" | "face" | "body" | "antenna";

export const POKE_ZONE_INDEX: Record<MascotPokeZone, number> = {
  rest: 0,
  head: 1,
  face: 2,
  body: 3,
  antenna: 4,
};

/** travelDir values, in the order of guide_travel_l / guide_travel_r (inferred). */
export const TRAVEL_DIR = { left: 0, right: 1 } as const;
export type MascotTravelDir = keyof typeof TRAVEL_DIR;

/** aimHand values: the file has aim_R0..R330 (right hand) before aim_L90..L270 (left hand) (inferred). */
export const AIM_HAND = { right: 0, left: 1 } as const;
export type MascotAimHand = keyof typeof AIM_HAND;
