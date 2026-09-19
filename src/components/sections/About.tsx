import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { Section } from '@/components/layout/Section'
import { profile } from '@/data/profile'
import { site } from '@/data/site'

export function About() {
  const [lead, ...rest] = profile.about
  return (
    <Section id="about" number={1} label={site.sections.about.label} title={site.sections.about.title}>
      <RevealOnScroll className="flex max-w-[60ch] flex-col gap-5">
        {/* The first paragraph leads, larger; the rest read as body text. */}
        <Reveal>
          <p className="font-display text-step-3 leading-snug tracking-[-0.01em] text-ink">{lead}</p>
        </Reveal>
        {rest.map((paragraph) => (
          <Reveal key={paragraph}>
            <p className="font-body text-step-2 leading-relaxed text-ink/75">{paragraph}</p>
          </Reveal>
        ))}
      </RevealOnScroll>
    </Section>
  )
}
