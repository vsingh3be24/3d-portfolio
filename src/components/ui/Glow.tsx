// A soft light behind a part of the page, in the accent or the glow colour,
// drifting slowly about its place. Painted with a gradient rather than a blur
// filter, so it costs nothing to draw and nothing to move.
export function Glow({
  className = '',
  tone = 'accent',
  delay = 0,
}: {
  className?: string
  tone?: 'accent' | 'glow'
  // Seconds into its drift, so neighbouring lights never move in step.
  delay?: number
}) {
  const colour = tone === 'accent' ? 'var(--ui-accent)' : 'var(--ui-glow)'
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full motion-safe:animate-drift ${className}`}
      style={{
        background: `radial-gradient(closest-side, rgb(${colour} / 0.16), rgb(${colour} / 0.05) 55%, transparent)`,
        animationDelay: `${-delay}s`,
      }}
    />
  )
}
