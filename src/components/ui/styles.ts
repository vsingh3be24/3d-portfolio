// One shape language for everything on the page, matching the pills that
// float over the estate: buttons and tags are round, cards are softly
// rounded. Kept here so no component invents its own.

const pillBase =
  'group inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 py-2 font-body text-step-0 font-medium transition-[transform,background-color,color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 focus-visible:-translate-y-0.5 active:translate-y-0'

export const pill = {
  primary: `${pillBase} bg-ink text-paper shadow-[0_1px_0_rgb(0_0_0/0.04)] hover:shadow-[0_8px_20px_-8px_rgb(var(--ui-ink)/0.45)]`,
  secondary: `${pillBase} border border-ink/20 text-ink hover:border-ink/60 hover:bg-ink/[0.04]`,
  accent: `${pillBase} bg-accent text-on-accent hover:shadow-[0_8px_20px_-8px_rgb(var(--ui-accent)/0.6)]`,
}

export const chip =
  'rounded-full border border-ink/15 px-3 py-1 font-body text-step-0 text-ink/80 transition-colors duration-200 hover:border-accent hover:text-accent'

export const eyebrow = 'font-body text-step-0 font-medium uppercase tracking-[0.16em] text-accent'

// A small arrow that nudges along with its pill on hover.
export const nudge = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'
