import "server-only";
import type { Scene } from "../lib/content/types";
import { plain } from "../lib/content/types";

/** Compact, PII-free lesson context for the tutor (no names, emails or job titles of the learner). */
export function lessonContext(moduleTitle: string, lessonTitle: string, scenes: Scene[], sceneId?: string | null): string {
  const lines: string[] = [`Module: ${moduleTitle}`, `Lesson: ${lessonTitle}`];
  const ordered = sceneId ? [...scenes.filter((s) => s.id === sceneId), ...scenes.filter((s) => s.id !== sceneId)] : scenes;
  for (const s of ordered) {
    switch (s.type) {
      case "tutor":
        lines.push(...s.beats.map((b) => `- ${b.say}`));
        break;
      case "choice":
        lines.push(`Question: ${s.question.prompt}`, ...s.question.options.map((o) => `  ${o.correct ? "[correct]" : "[wrong]"} ${o.label}: ${o.feedback}`));
        if (s.explain) lines.push(`  Why: ${s.explain}`);
        break;
      case "hotspot":
        lines.push(`Find the signs: ${s.prompt}`, ...s.spots.map((p) => `  ${p.label}: ${p.explain}`));
        break;
      case "swipe":
        lines.push(`Safe or trap: ${s.prompt}`, ...s.cards.map((c) => `  ${c.verdict}: ${c.explain}`));
        break;
      case "simulation":
        lines.push(`Simulation "${s.title}": ${s.intro}`);
        for (const st of s.steps) for (const a of st.actions) lines.push(`  ${a.label} → ${a.outcome}: ${a.feedback}`);
        break;
      case "scenario":
        lines.push(`Scenario "${s.title}"`);
        for (const n of s.nodes) for (const c of n.choices ?? []) lines.push(`  ${c.label}: ${c.feedback}`);
        break;
      case "match":
        lines.push(...s.pairs.map((p) => `  ${p.left} = ${p.right}`));
        break;
      case "order":
        lines.push(`Correct order: ${s.items.map((i) => i.label).join(" → ")}`);
        break;
      case "recap":
        lines.push(`Key points: ${s.points.join("; ")}`);
        break;
      case "intro":
        lines.push(`${s.title}: ${s.body}`);
        break;
      default:
        break;
    }
  }
  return lines.join("\n").slice(0, 9000);
}

/** Answer without the AI model: the most relevant explanation from the lesson itself. */
export function offlineAnswer(scenes: Scene[], sceneId: string | null | undefined, question: string): string {
  const q = question.toLowerCase();
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0];
  const pool: string[] = [];
  const push = (x?: string | null) => x && pool.push(x);
  for (const s of [scene, ...scenes]) {
    if (s.type === "choice") {
      push(s.explain);
      push(s.question.options.find((o) => o.correct)?.feedback);
    } else if (s.type === "hotspot") s.spots.forEach((p) => push(`${p.label}: ${p.explain}`));
    else if (s.type === "simulation") s.steps.forEach((st) => st.actions.filter((a) => a.outcome === "safe").forEach((a) => push(a.feedback)));
    else if (s.type === "recap") s.points.forEach(push);
    else if (s.type === "tutor") s.beats.forEach((b) => push(b.say));
    if (pool.length > 30) break;
  }
  const words = q.split(/\W+/).filter((w) => w.length > 3);
  const scored = pool.map((p) => ({ p, s: words.reduce((n, w) => n + (p.toLowerCase().includes(w) ? 1 : 0), 0) }));
  scored.sort((a, b) => b.s - a.s);
  const best = scored.slice(0, 2).map((x) => x.p);
  return best.length ? best.join(" ") : plain(pool[0] ?? "");
}

export const TUTOR_LANGUAGE: Record<string, string> = { az: "Azerbaijani", en: "English", ru: "Russian" };

export function tutorSystemPrompt(locale: string): string {
  return [
    "You are the friendly security tutor inside a cyber-hygiene training app for employees.",
    `Always answer in ${TUTOR_LANGUAGE[locale] ?? "English"}, in at most four short, plain sentences a non-technical employee understands.`,
    "Ground every answer in the lesson context you are given. Explain why something is suspicious and the one safe step to take.",
    "Never ask for or repeat passwords, codes or personal data. If the question is not about staying safe at work or online, say briefly that you can only help with this lesson's topic.",
    "Do not use markdown headings or lists; write normal sentences.",
  ].join(" ");
}
