// One shape language for everything on the page, matching the pills that
// float over the estate: buttons and tags are round, cards are softly
// rounded. Kept here so no component invents its own.

const pillBase =
  'group relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-2 font-body text-step-0 font-medium transition-[transform,background-color,color,border-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 focus-visible:-translate-y-0.5 active:translate-y-0'

// A band of light that sweeps across a filled pill on hover.
const sheen =
  "before:pointer-events-none before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:opacity-0 before:transition-[transform,opacity] before:duration-700 before:ease-out hover:before:translate-x-[320%] hover:before:opacity-100"

export const pill = {
  primary: `${pillBase} ${sheen} bg-ink text-paper shadow-[0_1px_0_rgb(0_0_0/0.04)] hover:shadow-[0_10px_30px_-10px_rgb(var(--ui-glow)/0.75)]`,
  secondary: `${pillBase} border border-ink/20 text-ink hover:border-glow/60 hover:bg-glow/[0.06] hover:shadow-[0_8px_26px_-14px_rgb(var(--ui-glow)/0.8)]`,
  accent: `${pillBase} ${sheen} bg-accent text-on-accent hover:shadow-[0_10px_30px_-8px_rgb(var(--ui-accent)/0.7)]`,
}

export const chip =
  'rounded-full border border-ink/15 bg-ink/[0.02] px-3 py-1 font-body text-step-0 text-ink/80 transition-[color,border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-accent/70 hover:bg-accent/[0.08] hover:text-ink hover:shadow-[0_6px_18px_-10px_rgb(var(--ui-accent)/0.9)]'

export const eyebrow = 'font-body text-step-0 font-medium uppercase tracking-[0.16em] text-accent'

// A small arrow that nudges along with its pill on hover.
export const nudge = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

// The accent line under headings: accent warming into the glow.
export const rule = 'h-[3px] rounded-full bg-gradient-to-r from-accent to-glow'
