"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { Mascot } from "@/components/mascot/mascot";
import type { CatInstance } from "@/components/mascot/cat/engine";
import { FOOT_Y, arcAt, bodyRect, boxFor, footCandidates, overlaps, pickPerch, planArc, type Arc, type Rect } from "./perch";
import { useGuide } from "./guide";

/**
 * The landing's one guide cat, travelling down the page with the visitor. It sits on perches, elements marked
 * `data-perch` (their top edge; `data-perch-text` uses the first line of a heading's text, `data-perch-box`
 * is a box the cat fills, the hero's spot beside the phone, and `data-perch-at` picks a point along the edge).
 * When its perch leaves the view (under the sticky header, or behind the caption dock) it jumps to the next
 * perch in view the way the page went, or to the furthest one when the page moves fast, along an arc in
 * step with the engine's jump pose; the next scroll can chain the next jump. It never sits where its body
 * would cover text or a control. With motion off it fades across instead.
 *
 * It lives in page coordinates (absolute in the tour, moved with transforms), so it stays glued to its perch
 * while the page scrolls with no frame of lag; only the jumps are animated (requestAnimationFrame).
 */

const PERCH = "[data-perch]";
const AVOID_TEXT = "h1,h2,h3,p,summary,label,th,td,blockquote,figcaption";
const AVOID = `${AVOID_TEXT},button,a,input,select,textarea,img`;

type Spot = { x: number; y: number; alt: number };

function motionOff(): boolean {
  return document.documentElement.dataset.motion === "still" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The perch's top edge in viewport px: a heading's first text line, or the element's box. */
function edgeOf(el: HTMLElement, range: Range): { left: number; right: number; top: number } | null {
  if (el.hasAttribute("data-perch-text")) {
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!rects.length) return null;
    const top = Math.min(...rects.map((r) => r.top));
    const line = rects.filter((r) => r.top < top + 4);
    return { left: Math.min(...line.map((r) => r.left)), right: Math.max(...line.map((r) => r.right)), top };
  }
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { left: r.left, right: r.right, top: r.top } : null;
}

/** The box for one of the perch's foot positions (`alt`), in viewport px. */
function spotAt(el: HTMLElement, size: number, vw: number, alt: number, range: Range): Spot | null {
  if (el.hasAttribute("data-perch-box")) {
    const r = el.getBoundingClientRect();
    return r.width ? { x: r.left, y: r.top, alt: 0 } : null;
  }
  const edge = edgeOf(el, range);
  if (!edge) return null;
  const at = el.dataset.perchAt ? Number(el.dataset.perchAt) : undefined;
  const text = el.hasAttribute("data-perch-text");
  const xs = footCandidates(edge, size, text ? "text" : "card", at);
  const box = xs[alt] === undefined ? null : boxFor(xs[alt], edge, size, vw, text ? 0.24 : -0.04);
  return box ? { ...box, alt } : null;
}

type Obstacle = { el: HTMLElement; r: DOMRect; text: boolean };

/** The text and controls on screen the cat must not sit on (its own button aside), measured once per decision. */
function obstacles(own: HTMLElement): Obstacle[] {
  const vh = window.innerHeight;
  const out: Obstacle[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(AVOID)) {
    if (own.contains(el)) continue;
    const r = el.getBoundingClientRect();
    // Not what is off screen, or hidden (a closed menu's links keep their boxes).
    if (r.bottom > 0 && r.top < vh && r.width > 1 && r.height > 1 && (el.checkVisibility?.() ?? true)) out.push({ el, r, text: el.matches(AVOID_TEXT) });
  }
  return out;
}

/** Whether a body covers any of them: a control's box, or one of a text's line boxes (centred text leaves its sides free). */
function covers(body: Rect, list: Obstacle[], range: Range): boolean {
  for (const o of list) {
    if (!overlaps(o.r, body)) continue;
    if (!o.text) return true;
    range.selectNodeContents(o.el);
    for (const r of range.getClientRects()) if (overlaps(r, body)) return true;
  }
  return false;
}

/** The first foot position on the perch where the cat covers nothing; the hero's box is placed by design. */
function bestSpot(el: HTMLElement, size: number, vw: number, list: () => Obstacle[], range: Range): Spot | null {
  for (let alt = 0; alt < 3; alt++) {
    const s = spotAt(el, size, vw, alt, range);
    if (s && (el.hasAttribute("data-perch-box") || !covers(bodyRect(s.x, s.y, size), list(), range))) return s;
  }
  return null;
}

export function ScrollCat({ label, tapPrompt, buttonRef, onTap, onHover }: { label: string; tapPrompt: string; buttonRef?: Ref<HTMLButtonElement>; onTap: () => void; onHover: () => void }) {
  const guide = useGuide();
  const wrap = useRef<HTMLDivElement>(null);
  const cat = useRef<CatInstance | null>(null);
  // From the crouch to the settled landing: gestures and one-shot moves wait for the ground, and hovering
  // does not pet a cat in the air.
  const [flying, setFlying] = useState(false);
  const [shown, setShown] = useState({ gesture: guide.gesture, fire: guide.fire });
  if (!flying && (shown.gesture !== guide.gesture || shown.fire !== guide.fire)) setShown({ gesture: guide.gesture, fire: guide.fire });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const range = document.createRange();
    const st = {
      perch: null as HTMLElement | null,
      alt: 0,
      x: 0,
      y: 0,
      phase: "sit" as "sit" | "crouch" | "air" | "fade",
      air: null as (Arc & { t0: number }) | null,
      readyAt: 0,
      decidedAt: -1e9,
      placed: false,
      jumps: 0,
      v: 0,
      lastY: window.scrollY,
      lastT: performance.now(),
    };
    let raf = 0;
    let later = 0;
    let rest = 0;
    let gone = false;
    const kick = () => {
      if (!raf && !gone) raf = requestAnimationFrame(tick);
    };
    const setPos = (x: number, y: number) => {
      st.x = x;
      st.y = y;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    // Perches near the view (half a screen beyond it), from an IntersectionObserver; all of them until it reports.
    const near = new Set<HTMLElement>();
    const watched = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) near.add(e.target as HTMLElement);
          else near.delete(e.target as HTMLElement);
        }
        kick();
      },
      { rootMargin: "50% 0px" },
    );
    const perches = (): HTMLElement[] => {
      const all = [...document.querySelectorAll<HTMLElement>(PERCH)];
      for (const p of all) {
        if (!watched.has(p)) {
          watched.add(p);
          io.observe(p);
        }
      }
      for (const p of near) if (!p.isConnected) near.delete(p);
      return near.size ? [...near] : all;
    };
    perches();

    /** The free band of the view for the cat's feet: below the sticky header (with the whole cat), above the caption dock. */
    const band = (size: number) => {
      const vh = window.innerHeight;
      const top = (document.querySelector("[data-site-header]")?.getBoundingClientRect().bottom ?? 0) + FOOT_Y * size;
      const bottom = document.querySelector("[data-guide-dock]")?.getBoundingClientRect().top ?? vh;
      return { vh, top, bottom };
    };

    const land = (target: HTMLElement, alt: number, x: number, y: number) => {
      st.perch = target;
      st.alt = alt;
      el.dataset.perchOn = target.dataset.perch || "";
      setPos(x, y);
    };

    const fade = (target: HTMLElement, s: Spot) => {
      st.phase = "fade";
      const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
      out.onfinish = () => {
        const p = el.offsetParent?.getBoundingClientRect();
        const size = el.offsetWidth;
        const now = p ? spotAt(target, size, document.documentElement.clientWidth, s.alt, range) : null;
        land(target, s.alt, (now ?? s).x - (p?.left ?? 0), (now ?? s).y - (p?.top ?? 0));
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        out.cancel();
        st.phase = "sit";
        st.readyAt = performance.now() + 250;
        kick();
      };
    };

    const go = (target: HTMLElement, s: Spot, size: number, parent: DOMRect, instant: boolean) => {
      const toX = s.x - parent.left;
      const toY = s.y - parent.top;
      const c = cat.current;
      const behaviour = c?.state.behaviour;
      if (instant) {
        land(target, s.alt, toX, toY);
        return;
      }
      if (!c || motionOff() || behaviour === "sleep" || behaviour === "wake") {
        fade(target, s);
        return;
      }
      // A cat far off screen comes in from just past the edge of the view: from under the sticky header
      // (its lower edge), or from below the bottom.
      const from = () => {
        const p = el.offsetParent?.getBoundingClientRect() ?? parent;
        const header = document.querySelector("[data-site-header]")?.getBoundingClientRect().bottom ?? 0;
        const above = header - size - p.top;
        const below = window.innerHeight - p.top;
        return { x: st.x, y: st.y < above ? above : st.y > below ? below : st.y, edge: st.y < above };
      };
      const f0 = from();
      const plan = planArc(f0.x, f0.y, toX, toY, size, f0.edge);
      st.phase = "crouch";
      // A jump from the settling landing ends the one before (its onDone runs now), so only the latest clears the flag.
      const id = ++st.jumps;
      setFlying(true);
      c.jump({
        dir: toY < f0.y - size * 0.25 ? "up" : "down",
        hang: plan.ms,
        onTakeoff: () => {
          const f = from();
          const p = el.offsetParent?.getBoundingClientRect() ?? parent;
          const now = spotAt(target, el.offsetWidth, document.documentElement.clientWidth, s.alt, range);
          const to = now ? { x: now.x - p.left, y: now.y - p.top } : { x: toX, y: toY };
          st.air = { ...planArc(f.x, f.y, to.x, to.y, size, f.edge), ms: plan.ms, t0: performance.now() };
          st.phase = "air";
          kick();
        },
        onLand: () => {
          const a = st.air;
          const end = a ? arcAt(a, 1) : { x: toX, y: toY };
          st.air = null;
          land(target, s.alt, end.x, end.y);
          st.phase = "sit";
          st.readyAt = performance.now() + 200;
          kick();
        },
        onDone: () => {
          if (st.jumps === id) setFlying(false);
        },
      });
    };

    const decide = (now: number, size: number, parent: DOMRect) => {
      const vw = document.documentElement.clientWidth;
      const { vh, top, bottom } = band(size);
      const cur = st.perch && st.perch.isConnected ? spotAt(st.perch, size, vw, st.alt, range) : null;
      const feet = cur ? cur.y + FOOT_Y * size : null;
      // Comfortable: the cat rides along. Past that (near the header, or at the dock) it looks for a perch in
      // the middle of the view; about to be hidden, it takes any perch in view rather than scroll away.
      const comfy = feet !== null && feet >= top + vh * 0.1 && feet <= bottom - vh * 0.01;
      const hidden = feet === null || feet < top + vh * 0.02 || feet > bottom;
      if (st.placed && comfy) return;
      if (!st.placed) {
        // The first placement: the hero perch beside the phone when it is in view.
        const hero = document.querySelector<HTMLElement>("[data-perch-box]");
        const s = hero ? spotAt(hero, size, vw, 0, range) : null;
        if (hero && s && s.y + FOOT_Y * size >= top + vh * 0.02 && s.y + FOOT_Y * size <= bottom) {
          go(hero, s, size, parent, true);
          st.placed = true;
          el.dataset.ready = "";
          return;
        }
      }
      // At most every 90 ms while the page moves; a timer after the scroll stops makes the last call.
      if (now - st.decidedAt < 90) return;
      st.decidedAt = now;
      const lo = top + vh * (hidden ? 0.04 : 0.2);
      const hi = bottom - vh * (hidden ? 0.01 : 0.05);
      const candidates: { item: { el: HTMLElement; s: Spot }; feet: number }[] = [];
      let list: Obstacle[] | null = null;
      const avoid = () => (list ??= obstacles(el));
      for (const p of perches()) {
        if (p === st.perch) continue;
        const s = bestSpot(p, size, vw, avoid, range);
        const f = s ? s.y + FOOT_Y * size : NaN;
        if (s && f >= lo && f <= hi) candidates.push({ item: { el: p, s }, feet: f });
      }
      const quick = Math.abs(st.v) > 1.4 || document.documentElement.dataset.motion === "calm";
      const pick = pickPerch(candidates, st.placed ? feet : null, quick, (lo + hi) / 2);
      if (pick) {
        go(pick.el, pick.s, size, parent, !st.placed);
      } else if (!st.placed) {
        // Nothing in view (a page opened far down): start on the hero perch, off screen, and come in from there.
        const hero = document.querySelector<HTMLElement>("[data-perch-box]");
        const s = hero ? spotAt(hero, size, vw, 0, range) : null;
        if (hero && s) go(hero, s, size, parent, true);
      }
      if (st.placed || st.perch) {
        st.placed = true;
        el.dataset.ready = "";
      }
    };

    function tick(now: number) {
      raf = 0;
      const parent = el!.offsetParent?.getBoundingClientRect();
      const size = el!.offsetWidth;
      if (!parent || !size) return;
      if (st.phase === "air" && st.air) {
        const p = arcAt(st.air, (now - st.air.t0) / st.air.ms);
        setPos(p.x, p.y);
        // Until touchdown (onLand), which the engine calls from its own frame.
        if (now - st.air.t0 < st.air.ms) kick();
        return;
      }
      // On a perch (also while crouching and settling): follow it if the layout moved it.
      if (st.perch && st.phase !== "fade") {
        const s = st.perch.isConnected ? spotAt(st.perch, size, document.documentElement.clientWidth, st.alt, range) : null;
        if (s && (Math.abs(s.x - parent.left - st.x) > 0.5 || Math.abs(s.y - parent.top - st.y) > 0.5)) setPos(s.x - parent.left, s.y - parent.top);
      }
      if (st.phase !== "sit") return;
      if (now < st.readyAt) {
        window.clearTimeout(later);
        later = window.setTimeout(kick, st.readyAt - now + 5);
        return;
      }
      decide(now, size, parent);
    }

    const onScroll = () => {
      const now = performance.now();
      const dt = now - st.lastT;
      if (dt > 0) {
        const v = (window.scrollY - st.lastY) / dt;
        st.v = dt > 120 ? v : st.v * 0.5 + v * 0.5;
      }
      st.lastY = window.scrollY;
      st.lastT = now;
      kick();
      window.clearTimeout(rest);
      rest = window.setTimeout(() => {
        st.v = 0;
        st.decidedAt = -1e9;
        kick();
      }, 140);
    };
    const ro = new ResizeObserver(() => kick());
    ro.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", kick, { passive: true });
    kick();
    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(later);
      window.clearTimeout(rest);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", kick);
    };
  }, []);

  return (
    <div ref={wrap} data-scroll-cat className="pointer-events-none absolute top-0 left-0 z-10 size-20 opacity-0 will-change-transform data-ready:opacity-100 sm:size-28">
      <button
        ref={buttonRef}
        type="button"
        onClick={onTap}
        onPointerEnter={flying ? undefined : onHover}
        aria-label={tapPrompt}
        // The box is wider than the cat: only the hit area over its body (below) takes the pointer, so the
        // transparent strip does not cover what is beside it (the hero phone's "open" button).
        className="pointer-events-none relative size-full rounded-2xl"
      >
        <Mascot
          mood={guide.mood}
          talking={guide.talking}
          gesture={shown.gesture?.name}
          gestureKey={shown.gesture?.key}
          guide={guide.pose}
          aim={guide.aim}
          fire={shown.fire ?? undefined}
          act={guide.act}
          // Between the lines the guide lives on its own (sleeps, grooms, plays); a line brings it back to sitting.
          auto={guide.mood === "idle" && !guide.talking && !guide.aim}
          label={label}
          // Toward the phone it peeks from; the Mascot turns it to the right in a right-to-left page, where the
          // perch boxes sit on the phone's other side (-end-*).
          // shortcut: perch.ts FOOT_X and BODY were measured on the left-facing cat, so in RTL the body check is
          // about 8% of the box off; mirror them if the turned cat is seen covering a heading's letters.
          facing="left"
          // A canvas half a box wider, centred on the box: the sitting cat keeps its size and place (the engine
          // fits it by height), and the stretched body and tail of a jump have room instead of being cut off.
          className="absolute inset-y-0 -inset-x-1/4"
          onCat={(c) => {
            cat.current = c;
          }}
        />
        <span aria-hidden className="pointer-events-auto absolute inset-x-[22%] inset-y-[6%]" />
      </button>
    </div>
  );
}
