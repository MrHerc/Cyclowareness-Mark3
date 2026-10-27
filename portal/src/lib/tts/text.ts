/**
 * The text the narrator reads and highlights. Shared by the player (src/components/player/narrator.ts),
 * the clip generator (scripts/generate-narration.ts) and the clip manifests, which are keyed by speechText.
 */

/** What is read aloud: stage directions such as <breath> or <short pause> dropped, spaces collapsed. */
export function speechText(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** The karaoke words: the speech text split on whitespace, so every script (Arabic, Georgian…) works. */
export function wordsOf(text: string): string[] {
  return speechText(text).split(/\s+/).filter(Boolean);
}

/** Where each of `words` (wordsOf(clean)) starts in `clean` (speechText), in UTF-16 code units. */
export function wordOffsets(clean: string, words: readonly string[]): number[] {
  const offsets: number[] = [];
  let pos = 0;
  for (const w of words) {
    const at = clean.indexOf(w, pos);
    offsets.push(at);
    pos = at + w.length;
  }
  return offsets;
}
