import type { PointerEvent } from 'react'
import { CountUp } from '@/components/motion/CountUp'
import { Magnetic } from '@/components/motion/Magnetic'
import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { Section } from '@/components/layout/Section'
import { chip, nudge, pill } from '@/components/ui/styles'
import { OVERVIEW_ID, plots, type Plot } from '@/data/plots'
import { site } from '@/data/site'
import { useEstate } from '@/store/useEstate'
import { themes } from '@/theme'

const projects = plots.filter((plot) => plot.kind === 'project')

// Straight into the project's room, with its overview open, from wherever on
// the page the visitor is reading.
function walkInside(plot: Plot) {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  const { goToPlot, goToExhibit } = useEstate.getState()
  goToPlot(plot.id)
  if (plot.overview) goToExhibit(OVERVIEW_ID)
}

// Where the pointer is over a card, as CSS variables its light layers read.
// Written straight onto the element, so following the pointer never renders.
function trackPointer(event: PointerEvent<HTMLDivElement>) {
  const card = event.currentTarget
  const box = card.getBoundingClientRect()
  card.style.setProperty('--spot-x', `${event.clientX - box.left}px`)
  card.style.setProperty('--spot-y', `${event.clientY - box.top}px`)
}

function ProjectCard({ plot, index }: { plot: Plot; index: number }) {
  const links = plot.links.filter((link) => link.href !== '#')
  const facts = plot.overview?.facts.slice(0, 3) ?? []
  // The building's roof colour: the same swatch the estate's tab bar points at.
  const roof = themes.day[plot.palette.roof]

  return (
    <div
      onPointerMove={trackPointer}
      className="group/card relative rounded-3xl transition-transform duration-500 ease-out hover:-translate-y-1"
    >
      {/* A soft light under the pointer, and the rim lit where it passes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
        style={{
          background:
            'radial-gradient(520px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgb(var(--ui-glow) / 0.10), transparent 55%)',
        }}
      />
      <div
        aria-hidden
        className="border-mask pointer-events-none absolute inset-0 rounded-3xl p-px opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
        style={{
          background:
            'radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgb(var(--ui-glow) / 0.9), rgb(var(--ui-accent) / 0.5) 40%, transparent 70%)',
        }}
      />
      <RevealOnScroll className="relative rounded-3xl border border-ink/10 bg-ink/[0.025] p-6 shadow-[0_30px_80px_-50px_rgb(0_0_0/0.6)] transition-[border-color,box-shadow] duration-500 group-hover/card:border-transparent group-hover/card:shadow-[0_40px_90px_-40px_rgb(var(--ui-accent)/0.45)] sm:p-8">
      {/* A large faint number, set behind the card's top corner. */}
      <span
        aria-hidden
        className="text-outline pointer-events-none absolute right-6 top-3 select-none font-display text-[104px] font-bold leading-none transition-opacity duration-500 group-hover/card:opacity-0 sm:right-8"
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <span
        aria-hidden
        className="text-gradient pointer-events-none absolute right-6 top-3 select-none font-display text-[104px] font-bold leading-none opacity-0 transition-opacity duration-500 group-hover/card:opacity-25 sm:right-8"
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <Reveal>
        <p className="flex items-center gap-2 font-body text-step-0 text-ink/55">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full ring-2 ring-ink/10"
            style={{ backgroundColor: roof, boxShadow: `0 0 12px ${roof}` }}
          />
          {plot.eyebrow}
        </p>
      </Reveal>
      <Reveal>
        <h3 className="mt-1 font-display text-step-4 font-semibold leading-tight tracking-[-0.02em] text-ink">
          {plot.title}
        </h3>
      </Reveal>
      <Reveal>
        <p className="text-gradient mt-1.5 font-body text-step-2 font-medium leading-snug">{plot.tagline}</p>
      </Reveal>
      <Reveal>
        <p className="mt-4 max-w-[62ch] font-body text-step-1 leading-relaxed text-ink/75">{plot.summary}</p>
      </Reveal>

      {facts.length > 0 && (
        <Reveal className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-ink/10 py-5 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label}>
              <div className="font-display text-step-4 font-semibold leading-none tracking-[-0.02em] text-ink">
                <CountUp value={fact.value} />
              </div>
              <div className="mt-1.5 max-w-[22ch] font-body text-step-0 leading-snug text-ink/55">{fact.label}</div>
            </div>
          ))}
        </Reveal>
      )}

      <Reveal>
        <ul className="mt-6 flex flex-col gap-2">
          {plot.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-3 font-body text-step-1 text-ink/80">
              <span aria-hidden className="mt-[0.72em] h-[2px] w-4 shrink-0 rounded-full bg-gradient-to-r from-accent to-glow" />
              {highlight}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal>
        <ul className="mt-6 flex flex-wrap gap-2">
          {plot.stack.map((tool) => (
            <li key={tool} className={chip}>
              {tool}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className="mt-7 flex flex-wrap gap-3">
        <Magnetic strength={0.2}>
          <button type="button" onClick={() => walkInside(plot)} className={pill.primary}>
            {site.walkInside}
            <span aria-hidden className={nudge}>
              →
            </span>
          </button>
        </Magnetic>
        {links.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className={pill.secondary}>
            {link.label}
            <span aria-hidden className={nudge}>
              ↗
            </span>
          </a>
        ))}
      </Reveal>
      </RevealOnScroll>
    </div>
  )
}

export function Projects() {
  const { label, title, intro } = site.sections.projects
  return (
    <Section id="projects" number={2} label={label} title={title} intro={intro}>
      <div className="flex flex-col gap-6">
        {projects.map((plot, index) => (
          <ProjectCard key={plot.id} plot={plot} index={index} />
        ))}
      </div>
    </Section>
  )
}
