import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { plots } from '@/data/plots'
import { useEstate } from '@/store/useEstate'

// Bottom centre: every building in one pill, for hopping straight from one
// room to the next. It repeats the destination list on purpose — the list is
// the considered way in, this is the quick way across.
const tabs = [
  ...plots.filter((plot) => plot.kind === 'about'),
  ...plots.filter((plot) => plot.kind === 'project'),
]

export function TabBar() {
  const activePlotId = useEstate((state) => state.activePlotId)
  const goToPlot = useEstate((state) => state.goToPlot)
  const activeRef = useRef<HTMLButtonElement>(null)

  // On a narrow screen the pill scrolls sideways; keep the current room in it.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activePlotId])

  return (
    <nav
      aria-label="Buildings"
      className="pointer-events-auto max-w-full overflow-x-auto rounded-full border border-ink/10 bg-paper/60 p-1 shadow-[0_12px_40px_-18px_rgb(0_0_0/0.55)] backdrop-blur-[12px] scrollbar-none"
    >
      <ul className="flex w-max items-center gap-0.5">
        {tabs.map((plot) => {
          const active = plot.id === activePlotId
          return (
            <li key={plot.id}>
              <button
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => goToPlot(plot.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded-full px-3.5 py-2 font-body text-step-0 transition-colors ${
                  active ? 'text-on-accent' : 'text-ink/75 hover:text-ink'
                }`}
              >
                {/* One pill, shared across the tabs, that slides to whichever
                    is active rather than fading out and in again. */}
                {active && (
                  <motion.span
                    layoutId="active-tab"
                    className="absolute inset-0 rounded-full bg-accent shadow-[0_0_20px_-2px_rgb(var(--ui-accent)/0.75)]"
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  />
                )}
                <span className="relative">{plot.shortName}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
