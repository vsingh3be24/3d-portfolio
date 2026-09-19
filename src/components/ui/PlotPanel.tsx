import { useEffect, useRef, useState } from 'react'
import { CountUp } from '@/components/motion/CountUp'
import { Reveal, RevealGroup } from '@/components/motion/Reveal'
import { chip, eyebrow, nudge, pill } from '@/components/ui/styles'
import { OVERVIEW_ID, plots, type Exhibit, type Plot, type PlotOverview } from '@/data/plots'
import { site } from '@/data/site'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { UI } from '@/scene/constants'
import { useEstate } from '@/store/useEstate'

// "plotId/exhibitId": a plain string, so the effect below can depend on it.
type Key = string

type Shown = { plot: Plot; exhibit: Exhibit } | { plot: Plot; overview: PlotOverview }

function resolve(key: Key): Shown | null {
  const [plotId, exhibitId] = key.split('/')
  const plot = plots.find((entry) => entry.id === plotId)
  if (!plot) return null
  if (exhibitId === OVERVIEW_ID) return plot.overview ? { plot, overview: plot.overview } : null
  const exhibit = plot.exhibits.find((entry) => entry.id === exhibitId)
  return exhibit ? { plot, exhibit } : null
}

function Links({ plot }: { plot: Plot }) {
  const links = plot.links.filter((link) => link.href !== '#')
  if (links.length === 0) return null
  return (
    <Reveal className="mt-8 flex flex-wrap gap-3">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target={link.href.startsWith('http') ? '_blank' : undefined}
          rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
          className={pill.secondary}
        >
          {link.label}
          <span aria-hidden className={nudge}>
            ↗
          </span>
        </a>
      ))}
    </Reveal>
  )
}

function Stack({ plot }: { plot: Plot }) {
  if (plot.stack.length === 0) return null
  return (
    <Reveal className="mt-8">
      <h4 className={eyebrow}>{site.builtWith}</h4>
      <ul className="mt-3 flex flex-wrap gap-2">
        {plot.stack.map((tool) => (
          <li key={tool} className={chip}>
            {tool}
          </li>
        ))}
      </ul>
    </Reveal>
  )
}

function OverviewBody({ plot, overview }: { plot: Plot; overview: PlotOverview }) {
  return (
    <>
      <div className="mt-6 flex max-w-[62ch] flex-col gap-4">
        {overview.intro.map((paragraph, index) => (
          <Reveal key={index}>
            <p className="font-body text-step-1 leading-relaxed text-ink/80">{paragraph}</p>
          </Reveal>
        ))}
      </div>

      <dl className="mt-8 grid max-w-[62ch] grid-cols-2 gap-x-6 gap-y-5 border-y border-ink/10 py-6">
        {overview.facts.map((fact) => (
          <Reveal key={fact.label}>
            <dt className="sr-only">{fact.label}</dt>
            <dd>
              <div className="font-display text-step-4 font-semibold leading-none tracking-[-0.02em] text-accent">
                <CountUp value={fact.value} />
              </div>
              <div className="mt-1.5 max-w-[24ch] font-body text-step-0 leading-snug text-ink/60">{fact.label}</div>
            </dd>
          </Reveal>
        ))}
      </dl>

      {overview.sections.map((section) => (
        <section key={section.title} className="mt-8 max-w-[62ch]">
          <Reveal>
            <h4 className="font-display text-step-2 font-semibold tracking-[-0.01em] text-ink">{section.title}</h4>
          </Reveal>
          <div className="mt-2 flex flex-col gap-3">
            {section.body.map((paragraph, index) => (
              <Reveal key={index}>
                <p className="font-body text-step-1 leading-relaxed text-ink/80">{paragraph}</p>
              </Reveal>
            ))}
          </div>
        </section>
      ))}

      <Stack plot={plot} />
      <Links plot={plot} />
    </>
  )
}

function ExhibitBody({ plot, exhibit }: { plot: Plot; exhibit: Exhibit }) {
  return (
    <>
      <div className="mt-6 flex max-w-[62ch] flex-col gap-4">
        {exhibit.body.map((paragraph, index) => (
          // Keyed by position: paragraphs are a fixed ordered list, and two of
          // them are allowed to read the same.
          <Reveal key={index}>
            <p className="font-body text-step-1 leading-relaxed text-ink/80">{paragraph}</p>
          </Reveal>
        ))}
      </div>
      <Links plot={plot} />
    </>
  )
}

// The panel, over the estate's column: its right side on desktop, all of it
// below the controls row on a phone, where the scene is too short to share
// and the way back out must stay in reach. It shows an exhibit, or the
// project's overview. It outlives the selection by one transition, so closing
// slides the content out instead of blanking it mid-animation. Closing
// returns to the room, not to the campus.
export function PlotPanel() {
  const activePlotId = useEstate((state) => state.activePlotId)
  const activeExhibitId = useEstate((state) => state.activeExhibitId)
  const backToInterior = useEstate((state) => state.backToInterior)
  const prefersReducedMotion = usePrefersReducedMotion()

  const currentKey: Key | null =
    activePlotId && activeExhibitId ? `${activePlotId}/${activeExhibitId}` : null

  const [shownKey, setShownKey] = useState<Key | null>(currentKey)
  const closeTimer = useRef<number | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Focus follows the panel open, so the next Tab reaches its links and close
  // button instead of starting again from the top of the page. Keyed on what
  // is shown, because the heading only exists once that has caught up. A new
  // subject also starts reading from the top.
  useEffect(() => {
    if (!currentKey || shownKey !== currentKey) return
    scrollRef.current?.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [currentKey, shownKey])

  useEffect(() => {
    if (currentKey) {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      setShownKey(currentKey)
      return
    }
    if (prefersReducedMotion) {
      setShownKey(null)
      return
    }
    closeTimer.current = window.setTimeout(() => setShownKey(null), UI.panelTransitionMs)
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [currentKey, prefersReducedMotion])

  const shown = shownKey ? resolve(shownKey) : null
  if (!shown) return null

  const open = currentKey !== null
  const isOverview = 'overview' in shown
  const title = isOverview ? shown.plot.title : shown.exhibit.name
  const lead = isOverview ? shown.plot.summary : shown.exhibit.claim
  const eyebrow = isOverview
    ? shown.plot.eyebrow
    : shown.plot.plotNumber === shown.plot.title
      ? shown.plot.title
      : `${shown.plot.plotNumber} · ${shown.plot.title}`

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end lg:flex-row lg:justify-end"
      aria-hidden={!open}
    >
      <div
        ref={scrollRef}
        // lg:w-[55%] must match FOCUS.panelFraction, which frames the room beside it.
        role="region"
        aria-label={title}
        className={`pointer-events-auto relative flex h-[calc(100%-3.75rem)] w-full flex-col overflow-y-auto border-t border-ink/15 bg-paper/95 px-6 py-6 transition-transform ease-out lg:h-full lg:w-[55%] lg:border-l lg:border-t-0 lg:px-10 lg:py-12 ${
          open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full lg:translate-y-0'
        }`}
        style={{ transitionDuration: prefersReducedMotion ? '0ms' : `${UI.panelTransitionMs}ms` }}
      >
        {/* Keyed on what is shown, so each new subject plays its entrance. */}
        <RevealGroup key={shownKey}>
          <Reveal>
            <div className="pr-14 font-body text-step-0 text-ink/50">{eyebrow}</div>
          </Reveal>
          <Reveal>
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 max-w-[18ch] font-display text-step-4 font-semibold leading-tight tracking-[-0.02em] text-ink outline-none"
            >
              {title}
            </h3>
          </Reveal>
          <Reveal>
            <p className="mt-3 max-w-[48ch] font-body text-step-2 leading-snug text-accent">{lead}</p>
          </Reveal>
          {isOverview ? (
            <OverviewBody plot={shown.plot} overview={shown.overview} />
          ) : (
            <ExhibitBody plot={shown.plot} exhibit={shown.exhibit} />
          )}
        </RevealGroup>

        {/* Last in reading order, so Tab from the heading runs through the
            content first; it still sits in the top corner. */}
        <button
          type="button"
          onClick={backToInterior}
          aria-label="Close exhibit"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 font-body text-step-2 leading-none text-ink/70 transition-colors hover:border-ink/50 hover:text-ink lg:right-6 lg:top-6"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
