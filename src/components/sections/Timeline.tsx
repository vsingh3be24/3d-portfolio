import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { Section } from '@/components/layout/Section'
import { profile } from '@/data/profile'
import { site } from '@/data/site'

// The line fills with the accent as the list is read, and each step lights
// up as the reading line reaches it.
export function Timeline() {
  const listRef = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 75%', 'end 55%'] })
  const fill = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 })

  return (
    <Section id="timeline" number={4} label={site.sections.timeline.label} title={site.sections.timeline.title}>
      <RevealOnScroll>
        <ol ref={listRef} className="relative">
          <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-ink/15" />
          <motion.span
            aria-hidden
            className="absolute bottom-2 left-[4px] top-2 w-[3px] origin-top rounded-full bg-gradient-to-b from-accent to-glow shadow-[0_0_14px_rgb(var(--ui-glow)/0.6)]"
            style={{ scaleY: fill }}
          />
          {profile.timeline.map((entry) => (
            <li key={`${entry.year}-${entry.label}`} className="relative pb-10 pl-10 last:pb-0">
              {/* Outside the reveal, whose movement would carry it off the line. */}
              <span
                aria-hidden
                className="absolute left-0 top-[0.4em] h-[11px] w-[11px] rounded-full border-2 border-accent bg-paper"
              >
                <motion.span
                  className="absolute -inset-[2px] rounded-full bg-glow shadow-[0_0_0_5px_rgb(var(--ui-accent)/0.18),0_0_18px_2px_rgb(var(--ui-glow)/0.7)]"
                  initial={{ opacity: 0, scale: 0.4 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ margin: '0px 0px -45% 0px' }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <Reveal>
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
