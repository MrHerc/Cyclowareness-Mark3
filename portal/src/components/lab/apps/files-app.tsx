"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Cog, FileText, Folder, Home, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { displayPath, nodeAt, resolvePath, type Machine } from "../model/shell";

/** A read-only file manager over the same file system the lab's terminal sees. */
export function FilesApp({ machine }: { machine: Machine }) {
  const t = useTranslations("learner.lab.vm.files");
  const [cwd, setCwd] = useState(machine.home);
  const [hidden, setHidden] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const node = nodeAt(machine.fs, cwd);
  const entries = node && node.kind === "dir" ? Object.entries(node.children).filter(([n]) => hidden || !n.startsWith(".")) : [];
  entries.sort(([a, x], [b, y]) => (x.kind === y.kind ? a.replace(/^\./, "").localeCompare(b.replace(/^\./, "")) : x.kind === "dir" ? -1 : 1));
  const places = [
    { path: machine.home, label: t("home"), icon: <Home /> },
    { path: `${machine.home}/Documents`, label: t("documents"), icon: <Folder /> },
    { path: `${machine.home}/Downloads`, label: t("downloads"), icon: <Folder /> },
    { path: `${machine.home}/Desktop`, label: t("desktop"), icon: <Folder /> },
  ];
  const file = preview ? nodeAt(machine.fs, preview) : null;
  const go = (p: string) => {
    setCwd(p);
    setPreview(null);
  };
  return (
    <div className="grid h-full min-h-0 grid-cols-1 @[34rem]:grid-cols-[10.5rem_minmax(0,1fr)]">
      <nav aria-label={t("places")} className="hidden min-h-0 overflow-y-auto border-r border-line bg-[#fafafc] p-2 @[34rem]:block">
        <ul className="grid gap-0.5">
          {places.map((p) => (
            <li key={p.path}>
              <button type="button" onClick={() => go(p.path)} aria-current={cwd === p.path ? "true" : undefined} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-tab hover:bg-sunken focus-visible:outline-2 focus-visible:outline-brand-600 pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:text-brand-600", cwd === p.path && "bg-brand-50 font-semibold")}>
                {p.icon}
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-2 py-1.5">
          <button type="button" disabled={cwd === "/"} onClick={() => go(resolvePath(machine, cwd, ".."))} aria-label={t("up")} className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-sunken disabled:opacity-40 pointer-coarse:size-11 [&_svg]:size-4">
            <ArrowUp />
          </button>
          <span className="min-w-0 flex-1 truncate font-mono text-tab text-ink-muted">{displayPath(machine, cwd)}</span>
          <label className="flex cursor-pointer items-center gap-1.5 text-tab text-ink-muted pointer-coarse:min-h-11">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="size-4 accent-brand-600" />
            {t("showHidden")}
          </label>
        </div>
        {file && file.kind === "file" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
              <FileText className="size-4 text-ink-subtle" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-tab font-semibold">{preview?.split("/").pop()}</span>
              <button type="button" onClick={() => setPreview(null)} aria-label={t("close")} className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-sunken pointer-coarse:size-11 [&_svg]:size-4">
                <X />
              </button>
            </div>
            {file.binary ? (
              <p className="m-auto max-w-xs px-4 text-center text-caption text-ink-subtle">{t("binary")}</p>
            ) : (
              <pre tabIndex={0} className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[0.75rem] leading-relaxed break-all whitespace-pre-wrap">
                {file.content}
              </pre>
            )}
          </div>
        ) : entries.length ? (
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label={displayPath(machine, cwd)}>
            {entries.map(([name, n]) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => (n.kind === "dir" ? go(resolvePath(machine, cwd, name)) : setPreview(resolvePath(machine, cwd, name)))}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-tab hover:bg-sunken focus-visible:outline-2 focus-visible:outline-brand-600 pointer-coarse:min-h-11"
                >
                  {n.kind === "dir" ? <Folder className="size-4.5 shrink-0 fill-[#c7d2fe] text-brand-600" aria-hidden /> : n.binary ? <Cog className="size-4.5 shrink-0 text-ink-muted" aria-hidden /> : <FileText className="size-4.5 shrink-0 text-ink-subtle" aria-hidden />}
                  <span className={cn("min-w-0 flex-1 truncate", name.startsWith(".") && "text-ink-muted")}>{name}</span>
                  <span className="shrink-0 text-tab-sm text-ink-subtle">{n.kind === "dir" ? t("folder") : n.binary ? t("program") : t("document")}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-auto text-caption text-ink-subtle">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
