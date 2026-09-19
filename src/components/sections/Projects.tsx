import { CountUp } from '@/components/motion/CountUp'
import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { Section } from '@/components/layout/Section'
import { chip, nudge, pill } from '@/components/ui/styles'
import { OVERVIEW_ID, plots, type Plot } from '@/data/plots'
import { site } from '@/data/site'
import { useEstate } from '@/store/useEstate'

const projects = plots.filter((plot) => plot.kind === 'project')

// Straight into the project's room, with its overview open, from wherever on
// the page the visitor is reading.
function walkInside(plot: Plot) {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  const { goToPlot, goToExhibit } = useEstate.getState()
  goToPlot(plot.id)
  if (plot.overview) goToExhibit(OVERVIEW_ID)
}

function ProjectCard({ plot, index }: { plot: Plot; index: number }) {
  const links = plot.links.filter((link) => link.href !== '#')
  const facts = plot.overview?.facts.slice(0, 3) ?? []

  return (
    <RevealOnScroll className="group/card relative rounded-3xl border border-ink/10 bg-paper p-6 transition-[border-color,box-shadow] duration-300 hover:border-ink/25 hover:shadow-[0_24px_60px_-32px_rgb(var(--ui-ink)/0.35)] sm:p-8">
      {/* A large faint number, set behind the card's top corner. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-6 top-4 font-display text-[88px] font-semibold leading-none text-ink/[0.05] transition-colors duration-300 group-hover/card:text-accent/[0.12] sm:right-8"
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <Reveal>
        <p className="font-body text-step-0 text-ink/50">{plot.eyebrow}</p>
      </Reveal>
      <Reveal>
        <h3 className="mt-1 font-display text-step-4 font-semibold leading-tight tracking-[-0.02em] text-ink">
          {plot.title}
        </h3>
      </Reveal>
      <Reveal>
        <p className="mt-1.5 font-body text-step-2 leading-snug text-accent">{plot.tagline}</p>
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
              <span aria-hidden className="mt-[0.72em] h-[2px] w-4 shrink-0 rounded-full bg-accent" />
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
        <button type="button" onClick={() => walkInside(plot)} className={pill.primary}>
          {site.walkInside}
          <span aria-hidden className={nudge}>
            →
          </span>
        </button>
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
