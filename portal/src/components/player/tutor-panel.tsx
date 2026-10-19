"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Mic, Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/mascot/mascot";
import { cn } from "@/lib/cn";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const LANG_TAG: Record<string, string> = { az: "az-AZ", en: "en-US", ru: "ru-RU" };

/** "Ask" in the lesson player: typed or spoken question, streamed answer, read aloud (`voice` off: typed and read only). */
export function TutorPanel({
  open,
  onClose,
  slug,
  lessonKey,
  sceneId,
  speak,
  voice = true,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  lessonKey: string;
  sceneId: string | null;
  speak: (text: string) => void;
  /** The tenant's "tutor_voice" feature: microphone input and spoken answers. */
  voice?: boolean;
}) {
  const t = useTranslations("player.tutor");
  const locale = useLocale();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "thinking" | "error">("idle");
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const suggestions = t.raw("suggestions") as string[];

  // Closing the panel ends the mic state at once (adjusted during render) and stops the recognition.
  if (listening && !open) setListening(false);
  useEffect(() => {
    if (!open) rec.current?.stop();
  }, [open]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 2 || state === "thinking") return;
    setQuestion(text);
    setAnswer("");
    setState("thinking");
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, lessonKey, sceneId, question: text, locale }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      setMode(res.headers.get("x-tutor-mode"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setAnswer(full);
      }
      setState("idle");
      if (voice) speak(full);
    } catch {
      setState("error");
    }
  };

  const listen = () => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = LANG_TAG[locale] ?? "en-US";
    r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      setQuestion(text);
      void ask(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };
  const canListen = voice && typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  return (
    <Dialog open={open} onClose={onClose} title={t("title")} size="md">
      <div className="flex items-start gap-3">
        <Mascot mood={state === "thinking" ? "think" : answer ? "happy" : "curious"} talking={state === "thinking"} guide={{ listen: listening }} className="size-20 shrink-0" />
        <div className="min-h-20 flex-1 rounded-2xl rounded-tl-sm bg-sunken px-4 py-3 text-body-sm">
          {state === "thinking" && !answer ? <span className="text-ink-muted">{t("thinking")}</span> : state === "error" ? <span className="text-risk-700">{t("error")}</span> : answer || <span className="text-ink-muted">{t("placeholder")}</span>}
        </div>
      </div>
      {mode === "offline" && answer ? <p className="mt-2 text-tab text-ink-subtle">{t("offline")}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} className="rounded-pill bg-brand-50 px-3 py-1.5 text-caption font-semibold text-brand-700 hover:bg-brand-100">
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder={t("placeholder")}
          aria-label={t("title")}
          className="h-12 min-w-0 flex-1 rounded-pill border border-line-strong bg-surface px-4 text-body-sm focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
        {canListen ? (
          <Button type="button" variant="secondary" size="icon" className={cn("size-12", listening && "bg-risk-50 text-risk-600")} aria-label={listening ? t("listening") : t("listen")} onClick={listen}>
            <Mic />
          </Button>
        ) : null}
        <Button type="submit" size="icon" className="size-12" aria-label={t("send")} disabled={state === "thinking"}>
          <Send />
        </Button>
      </form>
      <p className="mt-3 flex items-center gap-1.5 text-tab text-ink-subtle">
        <Lock className="size-3.5" />
        {t("privacy")}
      </p>
    </Dialog>
  );
}
