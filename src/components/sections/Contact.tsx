import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { Section } from '@/components/layout/Section'
import { nudge, pill } from '@/components/ui/styles'
import { profile } from '@/data/profile'
import { site } from '@/data/site'

export function Contact() {
  return (
    <Section id="contact" number={5} label={site.sections.contact.label} title={site.sections.contact.title}>
      <RevealOnScroll>
        <Reveal>
          <p className="max-w-[48ch] font-body text-step-2 leading-relaxed text-ink/75">{site.contactLine}</p>
        </Reveal>
        {/* The address itself, set large, with an underline that draws across on hover. */}
        <Reveal>
          <a
            href={`mailto:${profile.email}`}
            className="group mt-6 inline-flex max-w-full items-center gap-3 font-display text-step-4 font-semibold tracking-[-0.02em] text-ink"
          >
            <span className="relative break-all">
              {profile.email}
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-[3px] w-full origin-left scale-x-0 rounded-full bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100"
              />
            </span>
            <span aria-hidden className="text-accent transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </a>
        </Reveal>
        <Reveal className="mt-8 flex flex-wrap gap-3">
          {[
            { label: 'GitHub', href: profile.github },
            { label: 'LinkedIn', href: profile.linkedin },
            { label: 'LeetCode', href: profile.leetcode },
            { label: site.resumeLabel, href: profile.resume },
          ].map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className={pill.secondary}>
              {link.label}
              <span aria-hidden className={nudge}>
                ↗
              </span>
            </a>
          ))}
        </Reveal>
      </RevealOnScroll>
    </Section>
  )
}
