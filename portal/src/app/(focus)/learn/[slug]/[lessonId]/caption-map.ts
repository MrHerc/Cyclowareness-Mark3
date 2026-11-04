import "server-only";
import { speechText } from "@/lib/tts/text";
import { spokenTexts } from "@/server/subtitles";
import type { Scene } from "@/lib/content/types";

/**
 * Subtitles from a lesson's stored translation: each string the player speaks from `narrated` mapped to the same
 * string of `other`. Translations keep every id and array length (src/lib/content/locale-parity.ts), so both
 * rows list their spoken strings in the same order; an entry whose shape differs is left out, not guessed.
 */
export function captionMap(narrated: readonly Scene[], other: readonly Scene[]): Record<string, string> {
  const a = spokenTexts(narrated);
  const b = spokenTexts(other);
  if (a.length !== b.length) return {};
  const out: Record<string, string> = {};
  a.forEach((s, i) => {
    const t = b[i];
    if (s.parts.length !== t.parts.length) return;
    const caption = t.parts.map(speechText).filter(Boolean).join(t.sep);
    if (caption) out[s.parts.join(s.sep)] = caption;
  });
  return out;
}
