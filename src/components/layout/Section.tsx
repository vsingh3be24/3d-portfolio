import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { eyebrow } from '@/components/ui/styles'

type SectionProps = {
  id: string
  number: number
  label: string
  title: string
  intro?: string
  children: ReactNode
}

// Every section below the estate shares one shape: a numbered eyebrow, a
// heading and an accent rule that draws in, then the content. On a wide
// screen the heading takes a left column and stays in view while its
// content scrolls past; on a narrow one it simply sits on top.
export function Section({ id, number, label, title, intro, children }: SectionProps) {
  return (
    <section id={id} className="border-t border-ink/10">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-20 sm:px-10 lg:grid-cols-12 lg:gap-12 lg:py-28">
        <RevealOnScroll className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <Reveal>
              <p className={eyebrow}>
                {String(number).padStart(2, '0')} — {label}
              </p>
            </Reveal>
            <Reveal>
              <h2 className="mt-3 font-display text-step-5 font-semibold leading-[1.02] tracking-[-0.02em] text-ink">
                {title}
              </h2>
            </Reveal>
            <motion.div
              aria-hidden
              className="mt-5 h-[3px] w-12 origin-left rounded-full bg-accent"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            />
            {intro && (
              <Reveal>
                <p className="mt-5 max-w-[34ch] font-body text-step-1 leading-relaxed text-ink/65">{intro}</p>
              </Reveal>
            )}
          </div>
        </RevealOnScroll>
        <div className="lg:col-span-8">{children}</div>
      </div>
    </section>
  )
}
