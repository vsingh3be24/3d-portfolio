import { useEffect, useState } from 'react'
import { Magnetic } from '@/components/motion/Magnetic'
import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { Section } from '@/components/layout/Section'
import { nudge, pill } from '@/components/ui/styles'
import { profile } from '@/data/profile'
import { site } from '@/data/site'

const COPIED_MS = 1800

// The way to get in touch, in a card lit by a slowly turning ring of light:
// the address set large with a copy button, then the other places to look.
export function Contact() {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = () => {
    navigator.clipboard?.writeText(profile.email).then(
      () => setCopied(true),
      () => {},
    )
  }

  return (
    <Section id="contact" number={5} label={site.sections.contact.label} title={site.sections.contact.title}>
      <RevealOnScroll>
        <Reveal>
          <p className="max-w-[48ch] font-body text-step-2 leading-relaxed text-ink/75">{site.contactLine}</p>
        </Reveal>
        <Reveal className="relative mt-8 overflow-hidden rounded-[28px] p-px">
          {/* The ring: a conic sweep turning behind a card one pixel smaller. */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2 motion-safe:animate-spin-slow"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgb(var(--ui-accent)) 70deg, rgb(var(--ui-glow)) 120deg, transparent 180deg, transparent 360deg)',
            }}
          />
          <div className="relative overflow-hidden rounded-[27px] bg-paper p-7 sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full"
              style={{ background: 'radial-gradient(closest-side, rgb(var(--ui-glow) / 0.22), transparent)' }}
            />
            <p className="relative font-body text-step-1 text-ink/60">{site.contactKicker}</p>
            <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a
                href={`mailto:${profile.email}`}
                className="group inline-flex max-w-full items-center gap-3 font-display text-step-4 font-semibold tracking-[-0.02em] text-ink"
              >
                <span className="relative break-all">
                  {profile.email}
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 h-[3px] w-full origin-left scale-x-0 rounded-full bg-gradient-to-r from-accent to-glow transition-transform duration-500 ease-out group-hover:scale-x-100"
                  />
                </span>
                <span aria-hidden className="text-gradient transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </a>
              <button type="button" onClick={copy} className={pill.secondary} aria-live="polite">
                {copied ? site.copiedEmail : site.copyEmail}
              </button>
            </div>
            <div className="relative mt-8 flex flex-wrap gap-3">
              {[
                { label: 'GitHub', href: profile.github },
                { label: 'LinkedIn', href: profile.linkedin },
                { label: 'LeetCode', href: profile.leetcode },
                { label: site.resumeLabel, href: profile.resume },
              ].map((link, index) => (
                <Magnetic key={link.label} strength={0.2}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className={index === 0 ? pill.primary : pill.secondary}
                  >
                    {link.label}
                    <span aria-hidden className={nudge}>
                      ↗
                    </span>
                  </a>
                </Magnetic>
              ))}
            </div>
          </div>
        </Reveal>
      </RevealOnScroll>
    </Section>
  )
}
