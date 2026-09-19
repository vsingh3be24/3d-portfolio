import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { profile } from '@/data/profile'
import { site } from '@/data/site'

export function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-3xl px-6 py-24 sm:px-10 lg:px-0">
      <RevealOnScroll>
        <Reveal>
          <h2 className="font-display text-step-4 text-ink">Contact</h2>
        </Reveal>
        <Reveal>
          <p className="mt-6 max-w-prose font-body text-step-2 leading-relaxed text-ink/80">{site.contactLine}</p>
        </Reveal>
        <Reveal className="mt-8 flex flex-wrap gap-3">
          <a
            href={`mailto:${profile.email}`}
            className="border border-ink bg-ink px-5 py-2.5 font-body text-step-0 text-paper transition-opacity hover:opacity-85"
          >
            {profile.email}
          </a>
          <a
            href={profile.github}
            target="_blank"
            rel="noreferrer"
            className="border border-ink px-5 py-2.5 font-body text-step-0 text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            GitHub
          </a>
          <a
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
            className="border border-ink px-5 py-2.5 font-body text-step-0 text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            LinkedIn
          </a>
        </Reveal>
      </RevealOnScroll>
    </section>
  )
}
