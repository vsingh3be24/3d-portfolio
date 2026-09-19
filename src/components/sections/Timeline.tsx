import { motion } from 'framer-motion'
import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { Section } from '@/components/layout/Section'
import { profile } from '@/data/profile'
import { site } from '@/data/site'

export function Timeline() {
  return (
    <Section id="timeline" number={4} label={site.sections.timeline.label} title={site.sections.timeline.title}>
      <RevealOnScroll>
        <ol className="relative">
          {/* The line draws down as the list comes into view. */}
          <motion.span
            aria-hidden
            className="absolute bottom-2 left-[5px] top-2 w-px origin-top bg-ink/15"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
          {profile.timeline.map((entry) => (
            <li key={`${entry.year}-${entry.label}`} className="relative pb-8 pl-9 last:pb-0">
              <Reveal>
                <span
                  aria-hidden
                  className="absolute left-0 top-[0.4em] h-[11px] w-[11px] rounded-full border-2 border-accent bg-paper"
                />
                <div className="font-body text-step-0 font-medium uppercase tracking-[0.12em] text-accent">
                  {entry.year}
                </div>
                <div className="mt-1 font-display text-step-3 leading-snug tracking-[-0.01em] text-ink">
                  {entry.label}
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </RevealOnScroll>
    </Section>
  )
}
