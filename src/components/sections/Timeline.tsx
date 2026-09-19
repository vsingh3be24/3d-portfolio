import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { profile } from '@/data/profile'

export function Timeline() {
  return (
    <section id="timeline" className="mx-auto max-w-3xl px-6 py-24 sm:px-10 lg:px-0">
      <RevealOnScroll>
        <Reveal>
          <h2 className="font-display text-step-4 text-ink">Timeline</h2>
        </Reveal>
        <ol className="mt-10 space-y-6 border-l border-ink/20 pl-6">
          {profile.timeline.map((entry) => (
            <li key={`${entry.year}-${entry.label}`} className="relative">
              <Reveal>
                {/* A dot on the line for each entry. */}
                <span aria-hidden className="absolute -left-[29px] top-1.5 h-2 w-2 rounded-full bg-accent" />
                <div className="font-body text-step-0 text-ink/50">{entry.year}</div>
                <div className="mt-1 font-body text-step-2 text-ink">{entry.label}</div>
              </Reveal>
            </li>
          ))}
        </ol>
      </RevealOnScroll>
    </section>
  )
}
