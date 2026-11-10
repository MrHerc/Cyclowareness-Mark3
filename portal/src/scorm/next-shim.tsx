import type { AnchorHTMLAttributes } from "react";

/*
 * next/link and next/navigation in the SCORM bundle (scripts/build-scorm-player.ts aliases both here): the
 * package has no server and may open from file://, so an app path becomes a hash ("#/learn/<module>/<lesson>")
 * that src/scorm/app.tsx turns into the lesson to show.
 */
export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={`#${href}`} {...rest} />;
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useRouter() {
  return { refresh() {} };
}

/** useAction lets Next's redirect errors through; the package has no server to send one. */
export function unstable_rethrow() {}
