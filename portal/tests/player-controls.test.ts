import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Scene } from "@/lib/content/types";

vi.mock("@/server/db", () => ({ db: () => null, t: {} }));
vi.mock("@/server/env", () => ({ env: {} }));

const { isCharacterKey, leavesKeyAlone, letterShortcutsPref, localPref, sceneTitle, shortcutOf, transcriptOf, volumePref } = await import("@/components/player/controls");
const { captionMap } = await import("@/app/(focus)/learn/[slug]/[lessonId]/caption-map");
const { requestCaptions } = await import("@/components/player/captions");

const key = (k: string, code = "") => ({ key: k, code, ctrlKey: false, metaKey: false, altKey: false });

describe("player shortcuts", () => {
  it("maps keys to actions and leaves modified presses alone", () => {
    expect(shortcutOf(key(" ", "Space"), false)).toBe("toggle");
    expect(shortcutOf(key("m", "KeyM"), false)).toBe("mute");
    expect(shortcutOf(key("C", "KeyC"), false)).toBe("captions");
    expect(shortcutOf(key("t", "KeyT"), false)).toBe("transcript");
    expect(shortcutOf(key("s", "KeyS"), false)).toBe("syllabus");
    expect(shortcutOf(key("?", "Slash"), false)).toBe("help");
    expect(shortcutOf(key("x", "KeyX"), false)).toBeNull();
    expect(shortcutOf({ ...key("m", "KeyM"), ctrlKey: true }, false)).toBeNull();
    expect(shortcutOf({ ...key("ArrowRight"), metaKey: true }, false)).toBeNull();
  });

  it("follows the reading direction with the arrows", () => {
    expect(shortcutOf(key("ArrowRight"), false)).toBe("next");
    expect(shortcutOf(key("ArrowLeft"), false)).toBe("previous");
    expect(shortcutOf(key("ArrowRight"), true)).toBe("previous");
    expect(shortcutOf(key("ArrowLeft"), true)).toBe("next");
  });

  it("reads the key cap on Latin layouts and the key position on others", () => {
    // AZERTY: the M key cap sends "m" from another position.
    expect(shortcutOf(key("m", "Semicolon"), false)).toBe("mute");
    // Russian layout: the M position types "ь"; Arabic: the C position types "ؤ".
    expect(shortcutOf(key("ь", "KeyM"), false)).toBe("mute");
    expect(shortcutOf(key("ؤ", "KeyC"), true)).toBe("captions");
    expect(shortcutOf(key("ы", "KeyS"), false)).toBe("syllabus");
  });

  it("lets the learner turn off every character-key shortcut but keeps Space and the arrows (WCAG 2.1.4)", () => {
    const chars = ["m", "c", "t", "s", "?"].map((k) => shortcutOf(key(k), false)!);
    expect(chars.every(isCharacterKey)).toBe(true);
    expect([" ", "ArrowLeft", "ArrowRight"].map((k) => isCharacterKey(shortcutOf(key(k, k === " " ? "Space" : ""), false)!))).toEqual([false, false, false]);
  });
});

describe("keys the player leaves to the control under them", () => {
  // A stand-in for the DOM (the suite runs in node): a tag, attributes and a parent, and closest() over the selector
  // forms the player uses; any other form fails the test instead of matching by accident.
  class FakeElement {
    constructor(
      readonly tag: string,
      readonly attrs: Record<string, string> = {},
      readonly parent: FakeElement | null = null,
    ) {}
    matches(selector: string): boolean {
      const m = /^([a-z]*)((?:\[[^\]]+\])*)(?::not\(\[([a-z-]+)='([^']*)'\]\))?$/.exec(selector.trim());
      if (!m) throw new Error(`selector not covered by the stand-in: ${selector}`);
      const [, tag, attrs, notName, notValue] = m;
      if ((tag && tag !== this.tag) || (notName && this.attrs[notName] === notValue)) return false;
      return [...attrs.matchAll(/\[([a-z-]+)(?:=([^\]]+))?\]/g)].every(([, name, value]) => name in this.attrs && (value === undefined || this.attrs[name] === value.replace(/'/g, "")));
    }
    closest(selectors: string): FakeElement | null {
      if (selectors.split(",").some((s) => this.matches(s))) return this;
      return this.parent?.closest(selectors) ?? null;
    }
  }
  const el = (tag: string, attrs: Record<string, string> = {}, parent: FakeElement | null = null) => new FakeElement(tag, attrs, parent);
  beforeEach(() => vi.stubGlobal("Element", FakeElement));
  afterEach(() => vi.unstubAllGlobals());

  it("leaves every key to fields, selects, sliders, radio groups and anything in a dialog", () => {
    const owners = [el("input"), el("textarea"), el("select"), el("div", { role: "slider" }), el("div", { role: "radiogroup" }), el("p", { contenteditable: "true" }), el("button", {}, el("div", {}, el("dialog")))];
    for (const target of owners) for (const s of ["toggle", "next", "mute"] as const) expect(leavesKeyAlone(target as never, s), `${target.tag} ${s}`).toBe(true);
  });

  it("keeps Space for buttons, links and switches but takes the arrows and letters there", () => {
    for (const target of [el("button"), el("a", { href: "/x" }), el("span", {}, el("div", { role: "switch" }))]) {
      expect(leavesKeyAlone(target as never, "toggle"), target.tag).toBe(true);
      expect(leavesKeyAlone(target as never, "next"), target.tag).toBe(false);
      expect(leavesKeyAlone(target as never, "mute"), target.tag).toBe(false);
    }
  });

  it("takes every key on the page itself", () => {
    for (const target of [el("main"), el("a"), el("div", { contenteditable: "false" })]) expect(leavesKeyAlone(target as never, "toggle"), target.tag).toBe(false);
    expect(leavesKeyAlone(null, "toggle")).toBe(false);
  });
});

describe("subtitle requests", () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
  const noStored = async () => null;

  it("turns each answer into the state the picker shows", async () => {
    const replies = [reply(200, { lines: { Hi: "Hola" } }), reply(429), reply(503), reply(404), reply(500)];
    vi.stubGlobal("fetch", vi.fn(async () => replies.shift()!));
    const got = [];
    for (const k of ["a", "b", "c", "d", "e"]) got.push(await requestCaptions(`l:en:es:${k}`, "l", "es", false, noStored));
    expect(got).toEqual([{ map: { Hi: "Hola" } }, { error: "limited" }, { error: "unavailable" }, { error: "unavailable" }, { error: "error" }]);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await requestCaptions("l:en:es:f", "l", "es", false, noStored)).toEqual({ error: "error" });
  });

  it("sends one request per lesson and language at a time, and a new one on retry", async () => {
    let settle = () => {};
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() => new Promise((resolve) => (settle = () => resolve(reply(500)))));
    vi.stubGlobal("fetch", fetch);
    const first = requestCaptions("l:en:fa", "l", "fa", false, noStored);
    expect(requestCaptions("l:en:fa", "l", "fa", false, noStored)).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({ lessonId: "l", target: "fa" });
    settle();
    expect(await first).toEqual({ error: "error" });
    void requestCaptions("l:en:fa", "l", "fa", false, noStored);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports a stored translation that does not line up with the narrated text as unavailable", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await requestCaptions("l:en:az:1", "l", "az", true, async () => ({}))).toEqual({ error: "unavailable" });
    expect(await requestCaptions("l:en:az:2", "l", "az", true, noStored)).toEqual({ error: "unavailable" });
    expect(await requestCaptions("l:en:az:3", "l", "az", true, async (lessonId, locale) => ({ [lessonId]: locale }))).toEqual({ map: { l: "az" } });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("player preferences", () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)) };
  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it("keeps the volume in localStorage and ignores values out of range", () => {
    vi.stubGlobal("localStorage", storage);
    expect(volumePref.get()).toBe(1);
    volumePref.set(0.4);
    expect(store.get("cy:volume")).toBe("0.4");
    expect(volumePref.get()).toBe(0.4);
    store.set("cy:volume", "1.5");
    expect(volumePref.get()).toBe(0.4);
    store.set("cy:volume", "");
    expect(volumePref.get()).toBe(0.4);
    store.set("cy:volume", "0");
    expect(volumePref.get()).toBe(0);
  });

  it("keeps single-key shortcuts on until turned off", () => {
    vi.stubGlobal("localStorage", storage);
    expect(letterShortcutsPref.get()).toBe(true);
    letterShortcutsPref.set(false);
    expect(store.get("cy:shortcuts")).toBe("false");
    expect(letterShortcutsPref.get()).toBe(false);
  });

  it("falls back to the value set in this page when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const pref = localPref<number>("cy:test", 1, Number);
    const seen: number[] = [];
    pref.subscribe(() => seen.push(pref.get()));
    pref.set(0.25);
    expect(pref.get()).toBe(0.25);
    expect(seen).toEqual([0.25]);
  });
});

const en: Scene[] = [
  { type: "intro", id: "intro", title: "Fake invoices", body: "They look real." },
  { type: "tutor", id: "t", beats: [{ id: "b1", say: "Look at the <breath> sender.", mood: "talk", checkpoint: { prompt: "Who sent it?", options: [{ id: "a", label: "A", correct: true, feedback: "Yes." }] } }] },
  { type: "choice", id: "q", question: { prompt: "Pay it?", options: [{ id: "y", label: "Yes", correct: false, feedback: "No, check first." }, { id: "n", label: "No", correct: true }] }, explain: "Call the supplier." },
  { type: "recap", id: "r", points: ["Check the sender", "Call back"] },
] as Scene[];
const az: Scene[] = [
  { type: "intro", id: "intro", title: "Saxta fakturalar", body: "Həqiqi görünürlər." },
  { type: "tutor", id: "t", beats: [{ id: "b1", say: "Göndərənə <breath> baxın.", mood: "talk", checkpoint: { prompt: "Kim göndərib?", options: [{ id: "a", label: "A", correct: true, feedback: "Bəli." }] } }] },
  { type: "choice", id: "q", question: { prompt: "Ödəyək?", options: [{ id: "y", label: "Bəli", correct: false, feedback: "Xeyr, əvvəl yoxlayın." }, { id: "n", label: "Xeyr", correct: true }] }, explain: "Təchizatçıya zəng edin." },
  { type: "recap", id: "r", points: ["Göndərəni yoxlayın", "Geri zəng edin"] },
] as Scene[];

describe("subtitles from a stored translation", () => {
  it("maps each string the player speaks to the same string of the other row", () => {
    const map = captionMap(en, az);
    expect(map["Fake invoices. They look real."]).toBe("Saxta fakturalar. Həqiqi görünürlər.");
    // Keyed by the text passed to speak(); the subtitle drops the stage direction.
    expect(map["Look at the <breath> sender."]).toBe("Göndərənə baxın.");
    expect(map["Who sent it?"]).toBe("Kim göndərib?");
    expect(map["Pay it?"]).toBe("Ödəyək?");
    expect(map["No, check first. Call the supplier."]).toBe("Xeyr, əvvəl yoxlayın. Təchizatçıya zəng edin.");
    expect(map["Check the sender. Call back"]).toBe("Göndərəni yoxlayın. Geri zəng edin");
  });

  it("covers every transcript line and gives nothing for rows of another shape", () => {
    const map = captionMap(en, az);
    for (const line of transcriptOf(en)) expect(map[line.text]).toBeTruthy();
    expect(captionMap(en, az.slice(0, 2))).toEqual({});
  });
});

describe("syllabus and transcript lines", () => {
  it("names each scene by its title, question or first line", () => {
    expect(en.map(sceneTitle)).toEqual(["Fake invoices", "Look at the sender.", "Pay it?", ""]);
  });

  it("lists the narration of each scene as spoken, in order", () => {
    expect(transcriptOf(en)).toEqual([
      { scene: 0, text: "Fake invoices. They look real." },
      { scene: 1, text: "Look at the <breath> sender." },
      { scene: 1, text: "Who sent it?" },
      { scene: 2, text: "Pay it?" },
      { scene: 3, text: "Check the sender. Call back" },
    ]);
  });
});
