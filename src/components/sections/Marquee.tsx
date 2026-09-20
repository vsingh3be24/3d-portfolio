import { profile } from '@/data/profile'

const items = profile.skills.flatMap((group) => group.items)
const half = Math.ceil(items.length / 2)
const rows = [items.slice(0, half), items.slice(half)]

// The tools, set large and running sideways in two rows that pass each other,
// between the work and the list of skills. Decoration only: the same names
// are listed properly in the section below, so readers skip it.
function Row({ words, reverse, outlined }: { words: string[]; reverse: boolean; outlined: boolean }) {
  // Two copies side by side: moving one copy's width loops without a seam.
  const copy = (key: string) => (
    <ul key={key} className="flex shrink-0 items-center">
      {words.map((word) => (
        <li key={word} className="flex items-center">
          <span className={outlined ? 'text-outline [-webkit-text-stroke-color:rgb(var(--ui-ink)/0.35)]' : 'text-ink/85'}>
            {word}
          </span>
          <span className="text-gradient mx-6 text-[0.55em] sm:mx-9">✦</span>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="flex w-max">
      <div
        className={`flex w-max ${reverse ? 'motion-safe:animate-marquee-reverse' : 'motion-safe:animate-marquee'} group-hover/marquee:[animation-play-state:paused]`}
      >
        {copy('a')}
        {copy('b')}
      </div>
    </div>
  )
}

export function Marquee() {
  return (
    <div
      aria-hidden
      className="fade-x group/marquee relative select-none overflow-hidden py-12 font-display text-[44px] font-semibold leading-tight tracking-[-0.02em] sm:py-16 sm:text-[64px]"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/20 to-transparent" />
      <div className="-rotate-[1.5deg] space-y-2">
        <Row words={rows[0]} reverse={false} outlined={false} />
        <Row words={rows[1]} reverse outlined />
      </div>
    </div>
  )
}
