/** Shared look of the sign-in pages (sign-in, phone, 2FA, forgot, set password), so every step reads as one flow. */
export const authCard = "rounded-xl border border-line/80 bg-surface p-6 shadow-raised sm:rounded-2xl sm:p-9";
export const authTitle = "font-display text-[1.75rem] leading-[1.15] font-bold tracking-tight text-balance text-ink sm:text-[2rem]";
export const authLead = "mt-2 text-body-sm text-ink-muted";
/** Inputs on these pages are a step taller than the app's, with room for a leading icon. */
export const authInput = "h-12 ps-11";
export const authInputIcon = "pointer-events-none absolute top-1/2 start-3.5 size-4.5 -translate-y-1/2 text-ink-subtle";
export const authNotice = "flex items-start gap-2.5 rounded-md px-3.5 py-3 text-caption [&_svg]:mt-px [&_svg]:size-4 [&_svg]:shrink-0";
/** The "← name@example.com" pill that takes a step back to the email. */
export const authBackPill =
  "mb-4 inline-flex max-w-full items-center gap-1.5 rounded-pill border border-line bg-sunken/70 px-3 py-1.5 text-caption font-semibold text-ink-muted transition-colors hover:bg-sunken hover:text-ink pointer-coarse:min-h-11";
