import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { RisingText } from '@/components/motion/RisingText'
import { Glow } from '@/components/ui/Glow'
import { eyebrow, rule } from '@/components/ui/styles'

type SectionProps = {
  id: string
  number: number
  label: string
  title: string
  intro?: string
  children: ReactNode
}

// Every section below the estate shares one shape: a numbered eyebrow, a
// heading that rises in word by word and an accent rule that draws in, then
// the content. On a wide screen the heading takes a left column and stays in
// view while its content scrolls past; on a narrow one it sits on top. A
// large outlined number and a soft light sit behind, alternating sides.
export function Section({ id, number, label, title, intro, children }: SectionProps) {
  const index = String(number).padStart(2, '0')
  const left = number % 2 === 1

  return (
    // Clipped rather than hidden, so the sticky heading still sticks.
    <section id={id} className="relative overflow-x-clip border-t border-ink/10">
      <Glow
        tone={left ? 'accent' : 'glow'}
        delay={number * 3}
        className={`top-10 h-[520px] w-[520px] ${left ? '-left-56' : '-right-56'}`}
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-20 sm:px-10 lg:grid-cols-12 lg:gap-12 lg:py-28">
        <RevealOnScroll className="lg:col-span-4">
          <div className="relative lg:sticky lg:top-24">
            <span
              aria-hidden
              className="text-outline pointer-events-none absolute -left-2 -top-16 select-none font-display text-[150px] font-bold leading-none tracking-[-0.04em] sm:-top-20 sm:text-[180px]"
            >
              {index}
            </span>
            <Reveal>
              <p className={`relative ${eyebrow}`}>
                {index} — {label}
              </p>
            </Reveal>
            <h2 className="relative mt-3 font-display text-step-5 font-semibold leading-[1.02] tracking-[-0.02em] text-ink">
              <RisingText text={title} on="view" delay={0.15} lastClassName="text-gradient" />
            </h2>
            <motion.div
              aria-hidden
              className={`mt-5 w-14 origin-left ${rule}`}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
            {intro && (
              <Reveal>
                <p className="relative mt-5 max-w-[34ch] font-body text-step-1 leading-relaxed text-ink/65">{intro}</p>
              </Reveal>
            )}
          </div>
        </RevealOnScroll>
        <div className="relative lg:col-span-8">{children}</div>
      </div>
    </section>
  )
}
