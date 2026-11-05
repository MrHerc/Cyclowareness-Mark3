# Narration research — open-source and licence-safe voices (2026-11-05)

_Report of the research agent (Opus 5.5) for plan item 4.7. Facts carry their sources; the licence conclusions need counsel._

# Natural narration without a paid API key: research and generator design

Researched 2026-11-05 for Cyclowareness (`portal/`). Nothing in the repository was changed or installed. Sources follow each fact. Items marked **(unverified)** come from secondary sources or from my own knowledge and need checking.

## 0. What the current contract requires (from the repo)

- `portal/scripts/generate-narration.ts` calls ElevenLabs `text-to-speech/{voice}/with-timestamps` (`eleven_v3`, `mp3_44100_128`). It writes `public/generated/tts/<locale>/<sha256>.mp3` and `content/narration/<locale>/<module>__<lesson>.json`.
- A manifest maps `speechText(text)` to `NarrationClip = { url, durationMs, words: { w, startMs, endMs }[] }` (`src/lib/tts/clips.ts`). `words` has exactly one entry per `wordsOf(speechText(text))` word. `wordTimings(text, CharacterAlignment)` builds them from **per-character** times, and it tolerates dropped or extra characters.
- `isClipUrl` only accepts `/generated/tts/<xx>/<64 hex>.mp3`. Keeping MP3 means no change to the server or the player.
- The clip key is built from locale + `TTS_MODEL` + voice + text + `TTS_REVISION` (`src/lib/tts/key.ts`). A new provider or voice therefore gets new file names on its own, as long as provider and voice go into the key.
- `next.config.ts:44` already serves `/generated/tts/:path*` with `Cache-Control: public, max-age=31536000, immutable`. `public/sw.js` does not intercept `/generated/tts/`, which is good (see section 4).
- `narrator.ts` reuses one `HTMLAudioElement` (`audio.current ??= new Audio()`), sets `src`, then `play()`. It sets `el.volume`. It does not preload the next clip.
- ADR-028: 37,724 clips and 4.01 M characters for 10 languages (measured on 2026-11-04).

## 1. Piper TTS

### 1.1 Engine, releases, licence
- `rhasspy/piper` (MIT) is archived. Development moved to **OHF-Voice/piper1-gpl** (Open Home Foundation), which is **GPL-3.0** and "embeds espeak-ng for phonemization". https://github.com/OHF-Voice/piper1-gpl
- PyPI `piper-tts`: latest **1.8.0, released 2026-09-04**, licence GPL-3.0-or-later. It ships a Windows wheel `piper_tts-1.8.0-cp39-abi3-win_amd64.whl` (34.1 MB, CPython ≥ 3.9) and has an extra named `alignment`. https://pypi.org/project/piper-tts/
- There is no stand-alone Windows `.exe` release any more. You install it with `pip install piper-tts`. Since 1.5.0 libpiper also builds a C++ CLI, and Windows CI was added (MSVC/MSYS2). The old C++ code was removed in 1.3.0. CHANGELOG: https://github.com/OHF-Voice/piper1-gpl/blob/main/CHANGELOG.md
- CLI (docs/CLI.md): `python -m piper -m <voice> -f out.wav -- "text"`, `--input-file`, `--output-raw` (raw PCM stream), `--data-dir`, `--sentence-silence`, `--volume`, `--no-normalize`, `--cuda`. Voices are downloaded with `python -m piper.download_voices <name>`. There is no CLI flag for timings. https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/CLI.md
- Python API: `PiperVoice.load(model, include_alignments=True)`, then `voice.synthesize(text, SynthesisConfig(...))` yields one `AudioChunk` per sentence (`length_scale`, `noise_scale`, `noise_w_scale`, `volume`).
- The project says it is "intended for personal use and text to speech research only" and imposes "no additional restrictions on voice models". Each voice's `MODEL_CARD` holds the licence. https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md. The maintainer said the same in Nov 2023 ("responsibility of the end user"), and warned that espeak-ng is GPL ("I don't know if that somehow infects WAV files"). https://github.com/rhasspy/piper/discussions/271
- **GPL and this product:** if Piper and espeak-ng run only on the build machine and are never shipped in the Docker image or to customers, nothing is distributed, so GPL distribution terms do not apply. The FSF's view is that a program's output is not covered by its licence unless the output copies the program itself (GPL FAQ "GPLOutput", https://www.gnu.org/licenses/gpl-faq.html#GPLOutput). The MP3 files are therefore governed by the **voice** licence, not the engine licence. (Have counsel confirm before launch.)

### 1.2 Timings: Piper can produce them (no forced aligner needed)
- Experimental alignments since **1.3.1**. In-memory patching since **1.5.0**. https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/ALIGNMENTS.md
  - Enable them with `pip install piper-tts[alignment]` (pulls in `onnx`) and `PiperVoice.load(..., include_alignments=True)`. Or patch the file once with `python -m piper.patch_voice_with_alignment model.onnx`; a patched model still works on any Piper.
  - Each `AudioChunk` then carries `phonemes`, `phoneme_ids`, `phoneme_id_samples` (audio samples per phoneme id) and `phoneme_alignments` (phoneme, sample count). These are the VITS duration predictor's outputs, so they are exact for the audio produced.
- Turning these into word timings: espeak-ng output separates words with a space phoneme. Add up the samples per word group, divide by the sample rate (22,050 Hz for medium/high), and add the start of each sentence chunk. Map them onto `wordsOf(text)` in order. espeak sometimes changes the word count (numbers, abbreviations, "URL" spelled out), and then the number of word groups differs. In that case, spread the sentence's real duration over its words by character length; the sentence boundaries stay exact because each `AudioChunk` is one sentence.
- Lowest-effort integration: build a synthetic `CharacterAlignment` (each character of word *i* gets that word's start and end) and pass it to the existing `wordTimings()` unchanged. The same trick works for Azure word boundaries.
- Forced aligners as a fallback: torchaudio's `MMS_FA` and the MMS-300M aligner are CC-BY-NC (**unverified**, avoid them). Piper's own alignments make an aligner unnecessary.

### 1.3 Official voices and licences (read from every MODEL_CARD on huggingface.co/rhasspy/piper-voices, 2026-11-05)
Medium and low voices are about 63 MB of ONNX, multi-speaker ones about 77 MB, high voices 114–137 MB. Medium/high run at 22,050 Hz, low/x_low at 16,000 Hz. Samples: https://rhasspy.github.io/piper-samples/ . Model files: `https://huggingface.co/rhasspy/piper-voices/tree/main/<lang>/<locale>/<voice>/<quality>/`.

There is **no az_AZ voice** in `voices.json`. Its 58 locales include tr_TR, kk_KZ, fa_IR and ku_TR, but not Azerbaijani.

**Lineage warning.** Most medium voices say "Finetuned from U.S. English lessac voice". The lessac dataset (Blizzard 2013) licence allows **research purposes only**, explicitly excludes developing or selling voice-synthesis products, and is non-transferable (https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html). It is legally unsettled whether weights fine-tuned *from* a lessac checkpoint carry that restriction (a community reading in discussion #271 says they do; no maintainer ruling). The tables below therefore list the dataset licence and the lineage separately.

| Voice | Quality / size | Dataset licence | Lineage | Commercial verdict |
|---|---|---|---|---|
| en_US-ljspeech-high / -medium | high 114 MB / med 63 MB | public domain (LJ Speech) | no fine-tune noted | **safe**, recommended en (US female) |
| en_US-kristin-medium | med 63 MB | public domain (LibriVox) | none noted | **safe** |
| en_US-norman-medium | med 63 MB | public domain (LibriVox) | none noted | **safe** (male) |
| en_US-john-medium | med 63 MB | public domain (LibriVox) | fine-tuned from kristin | **safe** (male) |
| en_US-bryce-medium | med 63 MB | public domain (author's own voice) | own | safe |
| en_US-libritts_r-medium (2306 spk) / libritts-high | 81 / 137 MB | CC BY 4.0 | none | safe with attribution |
| en_GB-cori-high / -medium | 114 / 63 MB | public domain (LibriVox) | none noted | **safe**, recommended en-GB (female) |
| en_US-joe / mike-medium, en_US-reza_ibrahim-medium | med | CC0 | lessac | data safe, lineage risk |
| en_GB-alba / aru / vctk-medium | med | CC BY 4.0 | lessac | attribution + lineage risk |
| en_GB-northern_english_male / southern_english_female | med / low | CC-BY-SA 4.0 | lessac / Ryan | SA + lineage risk |
| en_US-sam-medium | med | Apache-2.0 | lessac | lineage risk |
| en_US-lessac-* | low/med/high | Blizzard research-only | — | **no** |
| en_US-ryan-*, hfc_female/male, l2arctic, en_GB-semaine | — | CC BY-NC(-SA) | — | **no** |
| en_US-amy, danny, kusal, arctic, kathleen(CC0, Ryan base), en_GB-alan, jenny_dioco | — | "See URL" / Mycroft / CMU / custom | various | unclear, avoid |
| **ru_RU-denis-medium** | med 63 MB | **CC0** (OHF voice-datasets) | lessac | data safe, lineage risk; best ru option |
| **ru_RU-dmitri-medium** | med 63 MB | **CC0** | lessac | same |
| ru_RU-irina-medium | med 63 MB | "Unknown" (RHVoice) | lessac | **no** |
| ru_RU-ruslan-medium | med 63 MB | CC BY-NC-SA 4.0 | lessac | **no** |
| uk_UA-mykyta / oleksa / tetiana-high | high 114 MB | Apache-2.0 | none noted | **safe** |
| uk_UA-ukrainian_tts-medium (3 spk) | 77 MB | CC0 | none noted | **safe** |
| uk_UA-lada-x_low | 21 MB | Apache-2.0 | — | safe, low quality |
| de_DE-mls-medium (236 spk) | 77 MB | CC BY 4.0 | none | safe with attribution |
| de_DE-thorsten-high/-medium, thorsten_emotional | 114 / 63 MB | CC0 | lessac (high, med) | data safe, lineage risk |
| de_DE-thorsten-low, kerstin-low | low | CC0 | Ryan (NC data) | lineage risk |
| de_DE-pavoque-low | low | CC BY-NC-SA | — | **no** |
| de_DE-eva_k, karlsson, ramona | — | M-AILABS "See URL" | — | unclear |
| fr_FR-mls-medium (125 spk) | 77 MB | CC BY 4.0 | none | safe with attribution |
| fr_FR-siwis-medium / -low | 63 / 28 MB | CC BY 4.0 | lessac / Ryan | attribution + lineage risk |
| fr_FR-upmc-medium | 77 MB | CC BY-SA 4.0 | lessac | SA + lineage risk |
| fr_FR-gilles-low | low | CC0 | Ryan | lineage risk |
| fr_FR-tom-medium | 44.1 kHz | **AGPLv3** (model) | — | avoid |
| ro_RO-mihai-medium | med 63 MB | CC0 | lessac | data safe, lineage risk (only ro voice) |
| tr_TR-dfki-medium | med 63 MB | **CC BY-NC-SA 4.0** | lessac | **no**: no commercial Turkish Piper voice |
| ka_GE-natia-medium | med 63 MB | RHVoice "See LICENSE" (personal use only per RHVoice wiki; Arch: "custom") | lessac | **no** |
| ar_JO-kareem-low / -medium | 63 MB | "See URL" (AliMokhammad/arabicttstrain) | lessac | unclear, avoid until checked |

Per-language Piper verdict: **en** fine (public domain, no lineage issue). **uk** fine. **de/fr** fine through the multi-speaker MLS voices (attribution; MLS sounds less polished than a single-speaker voice). **ru/ro** usable only if the owner accepts the lessac-lineage risk. **tr, ka, az** have no commercial Piper voice. **ar** is unclear.

### 1.4 CPU speed
- Real-time factor (RTF) for medium voices on a laptop CPU is about **0.1–0.2**, i.e. 5–10× faster than real time. Measurements: ~0.11 on a mid-range x86 laptop (WASM; https://voicechanger.live/text-to-speech/benchmarks), 0.153 on an i7-1255U (Dec 2025 arXiv, via https://www.cekura.ai/discover/piper-tts), 32× warm on a Mac (https://5uck1ess.github.io/tts-bench/mac-default/speed.html). Native onnxruntime is faster than WASM. Unreleased libpiper work claims about 3× more from multithreading (CHANGELOG). Benchmark one lesson locally with `--only` before planning around these numbers.

## 2. Azerbaijani: every option

| Option | az? | Licence / commercial | Cost | Timings | Verdict |
|---|---|---|---|---|---|
| **Azure AI Speech neural** | **az-AZ-BanuNeural (F), az-AZ-BabekNeural (M)** (https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts). Georgian too: ka-GE-EkaNeural / GiorgiNeural | commercial use under Microsoft Product Terms + TTS Code of Conduct (https://learn.microsoft.com/en-us/legal/cognitive-services/speech-service/tts-code-of-conduct), which asks for disclosure that the voice is synthetic | **F0 free: 0.5 M characters/month** (pricing page). S1 **$15 / 1 M chars**, Neural HD $22 / 1 M (Azure retail price API, eastus, queried 2026-11-05; HD rate effective 2026-03-01). F0 real-time: **20 transactions / 60 s**, not adjustable. Batch synthesis **not available on F0** (https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits) | Real time: `WordBoundary` events with audio offset and duration through the Speech SDK (npm `microsoft-cognitiveservices-speech-sdk`). Batch (S0): `wordBoundaryEnabled` → `[nnnn].word.json` with `Text`, `AudioOffset`, `Duration` in ms (https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-synthesis-properties) | **Commercial-safe today, free for az** (~400 k chars < 0.5 M F0). ~3,770 clips at 20/min ≈ 3.2 h of wall-clock time |
| ElevenLabs (current code) | yes (eleven_v3) | paid plans include a commercial licence; free plan has none for TTS (**unverified**, not stated on the API pricing page) | API $0.08 / 1 K chars for v3 and Multilingual v2, $0.04 for Flash (https://elevenlabs.io/pricing/api). az ≈ 400 k chars ≈ **$32**. Creator $22/mo = 275 k, Pro $99/mo = 1.238 M | character timestamps (already implemented) | commercial-safe, paid |
| Google Cloud TTS | **no az** in the voice table (Arabic is followed directly by Basque, https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types). The Gemini-TTS GA table lists 20 locales, no az (https://docs.cloud.google.com/text-to-speech/docs/gemini-tts). The Gemini API says 3.x TTS supports 100+ languages; az not confirmed | — | — | — | not an option today |
| Amazon Polly | **no az** (https://docs.aws.amazon.com/polly/latest/dg/supported-languages.html) | — | — | — | no |
| OpenAI TTS (gpt-4o-mini-tts, tts-1/-hd) | listed (follows Whisper languages), voices "optimized for English" | commercial OK; policy **requires telling users the voice is AI-generated** | about $0.015/min (**unverified**) | **no timestamps** (would need an aligner) | **deprecated, shuts down 2027-01-06** per the OpenAI TTS guide (https://developers.openai.com/api/docs/guides/text-to-speech). Do not build on it |
| Meta MMS-TTS `facebook/mms-tts-azj-script_latin` | yes (VITS) | **CC-BY-NC 4.0, confirmed** (https://huggingface.co/facebook/mms-tts-azj-script_latin). `mms-tts-azb` (South Azerbaijani) is NC too | free | VITS durations | **not commercial** |
| `ilqarrrr/Inflect_Micro_v2_Azerbaijan` | yes, compact VITS, 24 kHz, 2–4× real time on a laptop CPU, "clear but not fully natural, occasional metallic resonance" | weights Apache-2.0, but trained on `ughurabbasov/azerbaijani-tts-dataset`, which has **no licence file and no named speaker or consent** (only a community-tab "free use, credit me") (https://huggingface.co/ilqarrrr/Inflect_Micro_v2_Azerbaijan, https://huggingface.co/datasets/ughurabbasov/azerbaijani-tts-dataset) | free | VITS durations | **not commercial-safe** (provenance) |
| `Anadilorg/Anadil_Azerbaijani_TTS` (LoRA on openbmb/VoxCPM2), alpha | yes | LoRA weights MIT. Base model licence not stated on the card. Training data (281 k single-speaker segments) unnamed, "review dataset licence" (https://huggingface.co/Anadilorg/Anadil_Azerbaijani_TTS) | free, ~9 GB, CUDA preferred | none | **not commercial-safe** (data provenance unknown) |
| F5-TTS, XTTS-v2 | no az checkpoint | F5 checkpoints CC-BY-NC, XTTS CPML (non-commercial) | — | — | no |
| Chatterbox Multilingual (MIT) | **no az** (23 languages: ar da de el en es fi fr he hi it ja ko ms nl no pl pt ru sv sw tr zh) (https://huggingface.co/ResembleAI/chatterbox) | MIT | GPU | none | no az. Possible MIT option later for tr/ru/de/fr/ar (needs an aligner) |
| Kokoro, Orpheus | no az (**unverified**, not found in searches) | — | — | — | no |
| **Train our own Piper az voice** | espeak-ng has `az` (trk/az) (https://chromium.googlesource.com/chromiumos/third_party/espeak-ng/+/refs/heads/shan-language/docs/languages.md) | depends on the recordings | see below | Piper alignments | feasible only with **our own recordings** |

**Open corpora are not enough for a Piper voice.** Common Voice az is tiny: about 39 validated minutes according to one roster (https://huggingface.co/datasets/almaz-nlp/almaz-asr-roster), and CV 25.0 az has 215/93/126 train/dev/test clips (https://github.com/mammadovziya/whisper-az). It is CC0 but multi-speaker crowd audio, now distributed through Mozilla Data Collective. FLEURS az_az is about 10 h of multi-speaker read speech, CC-BY 4.0 (https://huggingface.co/datasets/google/fleurs). Neither is a clean single-speaker set.

**Piper training effort** (https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/TRAINING.md): `metadata.csv` (`file.wav|text`) plus WAVs and `--data.espeak_voice az`. Data needed: 10–15 h for a good fine-tune, 15–30 h from scratch, under 5 h for a small fine-tune. GPU: the authors use an A6000 or 3090; 8 GB VRAM is reported to work. Speed: 3090 ≈ 25 s per epoch per audio-hour, and 650–850 epochs for a 10–15 h fine-tune ≈ **50–60 GPU-hours** (about $30–60 on a rented cloud GPU, **estimate**). To avoid the lessac lineage, warm-start from a public-domain checkpoint (ljspeech/kristin; the checkpoint repo `rhasspy/piper-checkpoints` returned 401 to an anonymous fetch, so check availability) or train from scratch. The real cost is **recording**: a native az voice talent reads 3,000–6,000 prompts (5–15 h finished audio) in a quiet room, under a written commercial licence and consent. That takes roughly 2–4 weeks including cleanup.

**Commercial-safe az today: Azure (BanuNeural/BabekNeural, free within F0) and ElevenLabs (paid).** No open az model is commercial-safe.

## 3. Encoding: format and encoder

- **Format: keep MP3.** Chrome, Firefox, Safari (macOS/iOS) and Edge all play it, and `isClipUrl`, `clipUrl` and the manifests already assume `.mp3`. Opus in WebM plays reliably in Safari only from **17.4** (WebKit bug https://bugs.webkit.org/show_bug.cgi?id=238546; reports of iPad issues after that). Opus would also save only about 30–40 % at speech bitrates. AAC in `.m4a` works everywhere but buys nothing over MP3 here.
- **Settings:** mono, at the source sample rate (Piper medium 22,050 Hz; Azure use `audio-24khz-48kbitrate-mono-mp3` directly). Use CBR **48 kbps** (or 32–40 kbps; speech at 22 kHz is clean at 40). Normalise loudness (EBU R128 around −16 LUFS) so Piper and Azure clips sound equally loud.
- **Encoder: system `ffmpeg` (with libmp3lame), used only on the build machine** and never put in the runtime image. That means no distribution and no licence obligation in the product. The output MP3 is not a derivative of ffmpeg or LAME. LAME is LGPL; ffmpeg core is LGPL-2.1+ and becomes GPL only with `--enable-gpl` (https://github.com/Akemi/FFmpeg/blob/master/LICENSE.md). The common Windows builds (gyan.dev) are GPL builds (**unverified**), which is irrelevant if they are not shipped. One `ffmpeg -i in.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ac 1 -c:a libmp3lame -b:a 48k out.mp3` per clip, or a single ffmpeg per lesson reading a concat list.
- Pure-JS alternative with no system tool: `lamejs` / `@breezystack/lamejs` (LGPL-3.0, pure JS, unmaintained-ish: one maintainer, last release about a year ago; https://socket.dev/npm/package/@breezystack/lamejs/overview/1.2.5). It is fine as a devDependency, because it is never shipped to the browser or the server bundle. It is slower and has no loudnorm.
- **Encoder delay:** LAME adds about 1,105 samples (~50 ms at 22 kHz) of priming. Browsers that honour the LAME/Xing gapless header trim it (**unverified for Safari**). For karaoke 50 ms does not matter. Optionally measure it once and subtract.

## 4. Browser playback pitfalls

1. **iOS autoplay:** `play()` must be called synchronously inside the user gesture; any `await` before it loses the gesture (https://developer.apple.com/forums/thread/94522, https://bugs.webkit.org/show_bug.cgi?id=259925). After one element has played inside a gesture, later `src` swaps on **the same element** keep playing. `narrator.ts` already reuses one element, so keep it that way. Keep the first `speak()` of a lesson on the click path. If a lesson auto-starts without a tap, unlock it on the first tap: run `play()` on a short silent clip, then `pause()`. The existing `NotAllowedError` → Web Speech fallback is correct.
2. **iOS ignores `HTMLMediaElement.volume`** (read-only, always 1; Apple's Safari HTML5 audio docs, **unverified for iOS 18**). The player's volume slider will do nothing on iPhone. Hide it or use a Web Audio `GainNode` there.
3. **Preload the next clip:** with a single element, warm the HTTP cache for the next scene's clip with `fetch(url)` or `<link rel="preload" as="audio">`, so the swap is instant. Clips are about 40–60 KB, so prefetching the next two is cheap. Do not create a second `Audio` per clip on iOS.
4. **Range requests:** Safari first asks for `bytes=0-1` and treats a wrong range response as unplayable media (https://github.com/ember-cli/ember-cli/issues/8888, https://dev.to/philnash/service-workers-beware-safaris-range-request-38i7). Next.js serves `public/` through the `send` package (`node_modules/next/dist/server/serve-static.js`), which answers 206 with `Content-Range`. Verify on the deployed host with `curl -r 0-1 -I <clip>`. A proxy or CDN in front must forward `Range`.
5. **Service worker:** `public/sw.js` does not intercept `/generated/tts/`, so leave it that way. If clips are ever cached offline, the worker must answer `Range` with a 206 itself (Phil Nash article above).
6. **Caching:** `public, max-age=31536000, immutable` is already set and is correct, because file names are content hashes (`TTS_REVISION` covers re-takes). `proxy.ts` already makes sure no session cookie goes on those responses. Add `Content-Type: audio/mpeg` (send's default) and allow `Accept-Ranges`.
7. Setting `src` resets `playbackRate`. `narrator.ts` already re-applies `defaultPlaybackRate` and `playbackRate` after setting `src`. Keep `preservesPitch` at its default (true).

## 5. Rough numbers (4.01 M chars, ≈ 400 k and ≈ 3,770 clips per language, ≈ 106 chars per clip)

- **Audio length:** narration runs at about 14 chars/s (≈ 150 wpm). 400 k chars ≈ 28,600 s ≈ **7.9 h of audio per language** (≈ 7.6 s per clip). All ten languages ≈ 80 h.
- **Piper on a laptop CPU:** RTF 0.1–0.2 gives **~48–95 min per language**, plus ~5 min for ffmpeg. en+ru ≈ 2–3 h. Seven more Piper languages: 6–11 h of CPU (it can run overnight, or 2–4 worker processes on an 8-core machine).
- **Azure F0 for az:** 3,770 requests at 20/min ≈ **3.2 h** wall-clock, $0. A later full regeneration in the same month would exceed 0.5 M chars, so wait for the next month or pay $15/1 M (~$6 for 400 k).
- **Storage at 48 kbps mono:** 6,000 B/s × 28,600 s ≈ **170 MB per language** (≈ 45 KB per clip), so **≈ 1.7 GB for ten languages**. At 32 kbps: 115 MB per language and ≈ 1.15 GB total. ADR-028 bakes clips into the image, so the image size matters: consider 40 kbps, or serving `/generated/tts` from object storage or a CDN later.
- For comparison: Azure S1 for everything ≈ 4.01 M × $15 / 1 M ≈ **$60**. ElevenLabs ≈ $321 (ADR-028).

## 6. Recommended design for the generator

### 6.1 Provider abstraction (small, inside the existing script)
```ts
type Synth = { audio: Buffer /* mp3 */; durationMs: number; alignment: CharacterAlignment };
interface Provider { id: string /* goes into clipKey as the model */; voice(locale): string | undefined; maxChars: number; concurrency: number;
  synthesize(locale, key, text): Promise<Synth> }
```
- `elevenlabs`: today's `synthesize`, unchanged.
- `azure`: Speech SDK `SpeechSynthesizer` with `SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3`. Collect `wordBoundary` events (`audioOffset` in 100 ns ticks, `duration`, `text`, `textOffset`, `wordLength`). Turn them into a `CharacterAlignment` with `textOffset` and `wordLength`. Throttle to F0's 20/60 s (a token bucket). Mark 401/403 and quota-exceeded responses as `Fatal`.
- `piper`: one long-running Python worker (`scripts/piper_worker.py`, stdin and stdout as JSON lines) per voice, so the model loads once. It returns WAV and `phoneme_id_samples` per sentence. Node turns the space-separated phoneme groups into word spans (falling back to character-proportional spans within each sentence), builds the `CharacterAlignment`, and pipes the WAV through ffmpeg (loudnorm, mono, 48 kbps). Use a fixed `SynthesisConfig` (`length_scale` per voice, default `noise_scale`); Piper output is not bit-exact on reruns, but content-addressed keys make that harmless.
- Choose providers per locale with an env variable, e.g. `NARRATION_PROVIDER_AZ=azure`, `NARRATION_PROVIDER_EN=piper`, `NARRATION_VOICE_EN=en_US-ljspeech-high`. Put the provider id in `clipKey(locale, providerModel, voice, text)`, e.g. model `"piper-1.8"` and voice `"en_US-ljspeech-high"`. `TTS_MODEL` becomes per provider. No change is needed to `clips.ts`, `narration.ts`, `isClipUrl` or the player.
- Keep `--dry-run`, but print the cost per provider (Piper $0, Azure "free up to 0.5 M/month, then $15/1 M", ElevenLabs $0.08/1 K).

### 6.2 Timings strategy
Each provider returns a `CharacterAlignment`, and the existing `wordTimings()` (already tested, script-aware) produces `ClipWord[]`. Add one unit test per adapter: a fixture with numbers and abbreviations, asserting `words.length === wordsOf(text).length` and that times only move forward.

### 6.3 Build and CI step
- This is a manual or "content" job, not part of `npm run build`: `npx tsx --env-file=.env.local scripts/generate-narration.ts --locales en,ru` on a machine with Python 3.9+, `pip install "piper-tts[alignment]"` and `ffmpeg`. Voices are downloaded into a git-ignored cache (`python -m piper.download_voices --data-dir .cache/piper`).
- Commit the MP3s and manifests, or store them as a release artifact copied in before `docker build` (ADR-028 already says to run the generator before the image is built). Piper, espeak-ng, ffmpeg and Python **must never be installed in the runtime image**; at most they go in a separate builder stage.
- Add an attribution file (`public/generated/tts/CREDITS.txt` or the about page) for CC-BY voices (LibriTTS-R, MLS) and a list of public-domain sources. Add a "synthetic voice" note in the player (Microsoft's Code of Conduct; it is good practice anyway).

### 6.4 Per-language plan
- **en:** Piper `en_US-ljspeech-high` (public domain), or `en_GB-cori-high` (public domain) for a British voice. Male alternative: `en_US-norman-medium`.
- **ru:** Piper `ru_RU-denis-medium` or `ru_RU-dmitri-medium` (CC0 data, but lessac lineage). If the owner rejects the lineage risk, use Azure ru-RU (Svetlana/Dmitry, **names unverified**) in the next free month, or ~$6.
- **az:** Azure `az-AZ-BanuNeural` (female) or `az-AZ-BabekNeural` (male) on F0.
- **later:** uk with Piper (`uk_UA-tetiana-high` / `mykyta-high`, Apache-2.0). de/fr with Piper MLS (CC-BY) or Azure. **tr and ka with Azure** (no commercial Piper voice). ro with Piper mihai (lineage risk) or Azure. ar with Azure until kareem's licence is checked. At $15/1 M, every Azure language beyond the free month costs about $6.

### 6.5 The exact ask for the owner (az decision)
1. "Create a free Azure account and one **Speech** resource on the **Free (F0)** tier (region: West Europe or Germany West Central). Send me its **key and region**; they go into `.env.local` as `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` and are only read by the script. Azure sign-up asks for a card for identity checks, but F0 is not charged."
2. "Listen to **az-AZ-BanuNeural** (female) and **az-AZ-BabekNeural** (male) in the Azure Speech voice gallery, and choose one."
3. "Agree that the player shows a short 'synthetic voice' note (Microsoft TTS Code of Conduct)."
4. "Decide whether the Russian Piper voices (denis/dmitri, CC0 recordings but fine-tuned from a research-only English model) are acceptable, or whether ru should also use Azure."
5. Optional, long term: "If you want our own Azerbaijani voice that we own outright, we need a native voice talent to record about 10 h under a written commercial licence. After that, one Piper training run (~50–60 GPU-hours) makes it free forever."
If the owner declines Azure, the only other commercial-safe az option is ElevenLabs (about $32 one-off for az at API rates). Otherwise az stays on Web Speech, which is silent in Chrome on Windows.
