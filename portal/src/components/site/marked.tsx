import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Landing copy markup: [[…]] marks the part to look at, {{…}} the suspicious bit inside it.
 * With `reveal` off the text reads plainly (the visitor has to find it first).
 */
export function Marked({ text, reveal, className }: { text: string; reveal: boolean; className?: string }) {
  return <span className={className}>{parseMarked(text, reveal)}</span>;
}

// A plain function, not a component: the recursive-descent cursor is mutated while it runs.
function parseMarked(text: string, reveal: boolean): ReactNode[] {
  let i = 0;
  const parse = (until: string | null): ReactNode[] => {
    const out: ReactNode[] = [];
    let buf = "";
    const flush = () => {
      if (buf) out.push(<Fragment key={`t${i}-${out.length}`}>{buf}</Fragment>);
      buf = "";
    };
    while (i < text.length) {
      const two = text.slice(i, i + 2);
      if (until && two === until) {
        i += 2;
        break;
      }
      if (two === "[[" || two === "{{") {
        flush();
        i += 2;
        const inner = parse(two === "[[" ? "]]" : "}}");
        out.push(
          two === "[[" ? (
            <mark key={`m${i}`} className={cn("rounded-xs bg-transparent text-inherit transition-colors duration-(--duration-base)", reveal && "bg-reward-200/70 px-0.5 font-semibold")}>
              {inner}
            </mark>
          ) : (
            <span key={`f${i}`} className={cn("transition-colors duration-(--duration-base)", reveal && "text-risk-600 underline decoration-risk-500 decoration-wavy decoration-2 underline-offset-4")}>
              {inner}
            </span>
          ),
        );
        continue;
      }
      buf += text[i];
      i++;
    }
    flush();
    return out;
  };
  return parse(null);
}

/** Plain text of marked-up copy (for speech and aria labels). */
export function unmark(text: string): string {
  return text.replace(/\[\[|\]\]|\{\{|\}\}/g, "");
}
