"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { complete, displayPath, exec, type Machine, type OutTone, type ShellState, type ShellText } from "../model/shell";

type Line = { id: number; prompt?: string; text: string; tone?: OutTone | "in" };

const TONE: Record<OutTone | "in", string> = {
  in: "text-[#e6edf3]",
  err: "text-[#ff7b72]",
  ok: "text-[#7ee787]",
  dim: "text-[#8b949e]",
  head: "font-semibold text-[#e3b341]",
};
const MAX_LINES = 400;

function Prompt({ machine, cwd }: { machine: Machine; cwd: string }) {
  return (
    <span className="shrink-0 whitespace-pre">
      <span className="text-[#7ee787]">
        {machine.user}@{machine.host}
      </span>
      <span className="text-[#8b949e]">:</span>
      <span className="text-[#79c0ff]">{displayPath(machine, cwd)}</span>
      <span className="text-[#8b949e]">$ </span>
    </span>
  );
}

/**
 * A terminal over the lab shell: Enter runs a line, Tab completes (when something is typed, so an empty
 * prompt still lets keyboard users tab away), Up/Down walk the history, Ctrl+C cancels, Ctrl+L clears.
 * On touch screens a key row adds Tab and the history arrows.
 */
export function TerminalApp({ machine, shell, text, welcome, run }: { machine: Machine; shell: ShellState; text: ShellText; welcome: string; run: (line: string) => void }) {
  const t = useTranslations("learner.lab.vm.term");
  const [lines, setLines] = useState<Line[]>(() => [{ id: 0, text: welcome, tone: "dim" }]);
  const [input, setInput] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);
  const seq = useRef(1);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const push = (more: Omit<Line, "id">[], reset = false) => {
    const base = seq.current;
    seq.current += more.length;
    const added = more.map((l, i) => ({ ...l, id: base + i }));
    setLines((prev) => [...(reset ? [] : prev), ...added].slice(-MAX_LINES));
  };

  const promptText = `${machine.user}@${machine.host}:${displayPath(machine, shell.cwd)}$`;

  const submit = () => {
    const line = input;
    const r = exec(machine, shell, line, text);
    setInput("");
    setCursor(null);
    if (r.clear) push([], true);
    else push([{ prompt: promptText, text: line, tone: "in" }, ...r.out]);
    if (line.trim()) run(line);
  };

  const tab = () => {
    if (!input) return false;
    const r = complete(machine, shell, input);
    setInput(r.line);
    if (r.options.length) push([{ prompt: promptText, text: input, tone: "in" }, { text: r.options.join("  "), tone: "dim" }]);
    return true;
  };

  const walk = (dir: -1 | 1) => {
    const h = shell.history;
    if (!h.length) return;
    const next = cursor === null ? (dir === -1 ? h.length - 1 : null) : cursor + dir;
    if (next === null || next >= h.length) {
      setCursor(null);
      setInput("");
    } else {
      const i = Math.max(0, next);
      setCursor(i);
      setInput(h[i]);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Tab" && !e.shiftKey) {
      if (tab()) e.preventDefault();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      walk(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      walk(1);
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      push([{ prompt: promptText, text: `${input}^C`, tone: "in" }]);
      setInput("");
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      push([], true);
    }
  };

  const key = "inline-flex h-11 min-w-12 items-center justify-center gap-1 rounded-md bg-white/10 px-3 font-mono text-tab font-semibold text-[#e6edf3] active:bg-white/20 [&_svg]:size-4";
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b0f1a] font-mono text-[0.7rem] leading-[1.55] text-[#c9d1d9] @[30rem]:text-[0.78rem]">
      <div
        ref={box}
        onClick={() => {
          if (!window.getSelection()?.toString()) field.current?.focus({ preventScroll: true });
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 pt-2.5 pb-1"
      >
        <div role="log" aria-live="polite" aria-label={t("output")}>
          {lines.map((l) => (
            <div key={l.id} className={cn("break-all whitespace-pre-wrap", TONE[l.tone ?? "in"], !l.tone && "text-[#c9d1d9]")}>
              {l.prompt ? <span className="text-[#7ee787]">{l.prompt} </span> : null}
              {l.text || " "}
            </div>
          ))}
        </div>
        <label className="flex items-start">
          <span className="sr-only">{t("input")}</span>
          <Prompt machine={machine} cwd={shell.cwd} />
          <input
            ref={field}
            value={input}
            onChange={(e) => {
              setInput(e.target.value.slice(0, 200));
              setCursor(null);
            }}
            onKeyDown={onKey}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            aria-describedby="term-keys"
            className="min-w-0 flex-1 bg-transparent text-[#e6edf3] caret-[#7ee787] outline-none"
          />
        </label>
        <p id="term-keys" className="sr-only">
          {t("keys")}
        </p>
      </div>
      <div className="hidden shrink-0 gap-1.5 border-t border-white/10 px-2 py-1.5 pointer-coarse:flex">
        <button
          type="button"
          className={key}
          onClick={() => {
            tab();
            field.current?.focus();
          }}
        >
          Tab
        </button>
        <button
          type="button"
          className={key}
          aria-label={t("prev")}
          onClick={() => {
            walk(-1);
            field.current?.focus();
          }}
        >
          <ArrowUp />
        </button>
        <button
          type="button"
          className={key}
          aria-label={t("next")}
          onClick={() => {
            walk(1);
            field.current?.focus();
          }}
        >
          <ArrowDown />
        </button>
        <button type="button" className={cn(key, "ml-auto")} onClick={submit}>
          ⏎ {t("run")}
        </button>
      </div>
    </div>
  );
}
