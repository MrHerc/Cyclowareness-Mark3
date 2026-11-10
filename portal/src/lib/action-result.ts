/**
 * The answer of a server action called from a client component: a success with its data, or a refusal
 * with a key the client turns into a translated message (useAction, src/components/ui/use-action.ts).
 */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
