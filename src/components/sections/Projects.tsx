import { CountUp } from '@/components/motion/CountUp'
import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
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

function ProjectCard({ plot }: { plot: Plot }) {
  const links = plot.links.filter((link) => link.href !== '#')
  const facts = plot.overview?.facts.slice(0, 3) ?? []

  return (
    <RevealOnScroll className="border-t border-ink/15 pt-8">
      <Reveal>
        <p className="font-body text-step-0 text-ink/50">{plot.eyebrow}</p>
      </Reveal>
      <Reveal>
        <h3 className="mt-1 font-display text-step-4 leading-tight text-ink">{plot.title}</h3>
      </Reveal>
      <Reveal>
        <p className="mt-2 font-body text-step-2 leading-snug text-accent">{plot.tagline}</p>
      </Reveal>
      <Reveal>
        <p className="mt-4 max-w-prose font-body text-step-1 leading-relaxed text-ink/80">{plot.summary}</p>
      </Reveal>

      {facts.length > 0 && (
        <Reveal className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
          {facts.map((fact) => (
            <div key={fact.label}>
              <div className="font-display text-step-4 leading-none text-ink">
                <CountUp value={fact.value} />
              </div>
              <div className="mt-1.5 max-w-[20ch] font-body text-step-0 leading-snug text-ink/60">{fact.label}</div>
            </div>
          ))}
        </Reveal>
      )}

      <Reveal>
        <ul className="mt-6 flex flex-col gap-1.5">
          {plot.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-3 font-body text-step-1 text-ink/80">
              <span aria-hidden className="mt-[0.7em] h-px w-4 shrink-0 bg-accent" />
              {highlight}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal>
        <ul className="mt-6 flex flex-wrap gap-2">
          {plot.stack.map((tool) => (
            <li key={tool} className="border border-ink/20 px-2.5 py-1 font-body text-step-0 text-ink/80">
              {tool}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => walkInside(plot)}
          className="group inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 font-body text-step-0 text-paper transition-opacity hover:opacity-85"
        >
          {site.walkInside}
          <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        </button>
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 border border-ink px-4 py-2 font-body text-step-0 text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            {link.label}
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
              ↗
            </span>
          </a>
        ))}
      </Reveal>
    </RevealOnScroll>
  )
}

export function Projects() {
  return (
    <section id="projects" className="mx-auto max-w-3xl px-6 py-24 sm:px-10 lg:px-0">
      <RevealOnScroll>
        <Reveal>
          <h2 className="font-display text-step-4 text-ink">{site.projectsHeading}</h2>
        </Reveal>
        <Reveal>
          <p className="mt-3 max-w-prose font-body text-step-1 text-ink/70">{site.projectsIntro}</p>
        </Reveal>
      </RevealOnScroll>
      <div className="mt-12 flex flex-col gap-16">
        {projects.map((plot) => (
          <ProjectCard key={plot.id} plot={plot} />
        ))}
      </div>
    </section>
  )
}
