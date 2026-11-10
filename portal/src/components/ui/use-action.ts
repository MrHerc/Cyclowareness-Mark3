"use client";

import { useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";

/**
 * The server actions answer with ActionResult, the older `{ ok: boolean; error? }`, a form state `{ ok?; error? }`
 * or plain data (`{ count }`, nothing): a result is a refusal when `ok` is false or it carries an error key.
 */
type Outcome = { ok?: boolean; error?: string };
type Success<R> = R extends { ok: false } | { error: string } ? never : R;
type Failure<R> = R extends { ok: true } ? never : R;

export type ActionOptions<R> = {
  onSuccess?: (res: Success<R>) => void;
  successToast?: string | ((res: Success<R>) => string);
  /** The caller's own messages for refusals, by error key or from the whole result; anything else falls back to common.errors. */
  errorMap?: Partial<Record<string, string>> | ((res: Failure<R>) => string | undefined);
  /** Every failure goes to the caller instead of a toast, as an error key ("generic" for a failed call): a form in a dialog shows it inline and its own button retries. */
  onError?: (error: string) => void;
};

/** Refusals common.errors has a message for: the input or the person, so retrying the same call does not help. */
const COMMON = ["invalid", "rateLimited", "forbidden"] as const;
type Common = (typeof COMMON)[number];
type Tc = (key: `errors.${Common | "generic"}` | "retry") => string;

/**
 * Settles one call: success toast and callback, a refusal's message, or the generic failure with a retry.
 * Retry repeats the same call, so after a lost response a create action (incident, ticket reply, assignment) can run twice.
 */
export async function settle<R>(call: () => Promise<R>, options: ActionOptions<R>, tc: Tc, retry: () => void) {
  const failed = () => (options.onError ? options.onError("generic") : toast(tc("errors.generic"), "error", undefined, { label: tc("retry"), onClick: retry }));
  let res: R;
  try {
    res = await call();
  } catch (error) {
    // redirect() and notFound() from the action are navigation, not failures.
    unstable_rethrow(error);
    return failed();
  }
  const { ok, error } = (res ?? {}) as Outcome;
  if (ok !== false && !error) {
    const done = res as Success<R>;
    const message = typeof options.successToast === "function" ? options.successToast(done) : options.successToast;
    if (message) toast(message);
    options.onSuccess?.(done);
    return;
  }
  if (options.onError) return options.onError(error ?? "generic");
  const map = options.errorMap;
  const mapped = typeof map === "function" ? map(res as Failure<R>) : error ? map?.[error] : undefined;
  const common = COMMON.find((key) => key === error);
  if (mapped) toast(mapped, "error");
  else if (common) toast(tc(`errors.${common}`), "error");
  else failed();
}

/**
 * Calls a server action from a client component inside a transition: success toast and callback, a translated
 * message for a refusal, and for a call that failed (server unreachable, an unexpected refusal) the generic
 * message with a retry on the toast, instead of the error boundary or silence.
 */
export function useAction<A extends unknown[], R>(action: (...args: A) => Promise<R>, options: ActionOptions<R> = {}) {
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const run = (...args: A) => start(() => settle(() => action(...args), options, tc, () => run(...args)));
  return { run, pending };
}
