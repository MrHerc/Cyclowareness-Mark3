"""Piper worker for scripts/generate-narration.ts (build machine only: Piper is GPL and never ships).

Loads one voice once, with alignments, then answers one JSON line per request line on stdin:
  {"text": "...", "wav": "<path>"}  ->  {"rate": 22050, "samples": n, "sentences": [{"start": s, "end": e, "words": [[s, e], ...] | null}]}
Times are in samples from the start of the clip; a word is a run of phonemes between espeak's spaces.
"""
import json
import sys
import wave

from piper import PiperVoice

# Phonemes that are not part of a word: sentence start/end, padding, the word separator and punctuation.
NOT_WORD = set("^$_ .,;:!?¡¿—–…\"«»“”()[]-'")


def words_of(chunk, start):
    out, cur, at = [], None, start
    for a in chunk.phoneme_alignments:
        if a.phoneme == " ":
            cur = None
        elif a.phoneme not in NOT_WORD:
            if cur is None:
                cur = [at, at]
                out.append(cur)
            cur[1] = at + int(a.num_samples)
        at += int(a.num_samples)
    return out


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    voice = PiperVoice.load(sys.argv[1], include_alignments=True)
    rate = voice.config.sample_rate
    for line in sys.stdin:
        try:
            req = json.loads(line)
            pcm, sentences, at = [], [], 0
            for chunk in voice.synthesize(req["text"], include_alignments=True):
                n = len(chunk.audio_int16_array)
                words = words_of(chunk, at) if chunk.phoneme_alignments else None
                sentences.append({"start": at, "end": at + n, "words": words})
                pcm.append(chunk.audio_int16_bytes)
                at += n
            with wave.open(req["wav"], "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(rate)
                w.writeframes(b"".join(pcm))
            out = {"rate": rate, "samples": at, "sentences": sentences}
        except Exception as e:  # one bad text must not end the run
            out = {"error": f"{type(e).__name__}: {e}"}
        sys.stdout.write(json.dumps(out) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
