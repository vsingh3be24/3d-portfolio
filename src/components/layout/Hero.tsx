import { MotionConfig } from 'framer-motion'
import { ControlsHint, Location } from '@/components/ui/Meta'
import { PlotPanel } from '@/components/ui/PlotPanel'
import { SceneControls } from '@/components/ui/SceneControls'
import { TabBar } from '@/components/ui/TabBar'
import { site } from '@/data/site'
import { useEstate } from '@/store/useEstate'
import { IntroColumn } from './IntroColumn'
import { SceneColumn } from './SceneColumn'

// The estate's own UI floats inside its column: controls top right, the tab
// bar and controls hint bottom centre, the location bottom right, and an open
// exhibit's panel over the right of the scene. The overlay ignores the
// pointer except on its own controls, so the canvas stays draggable between.
function SceneOverlay() {
  const exhibitOpen = useEstate((state) => state.level === 'exhibit')
  const atCampus = useEstate((state) => state.level === 'campus')
  // With an exhibit open the panel covers the right of the scene on desktop,
  // so the controls and bottom row step left beside it; on a phone it is a
  // sheet over the whole scene, and the bottom row steps out of its way.
  // The panel's 55% is of the whole column, this margin's of the padded row,
  // so it carries a little extra to clear the panel's edge.
  const besidePanel = exhibitOpen ? 'lg:mr-[calc(55%+12px)]' : ''
  const underSheet = exhibitOpen ? 'max-lg:invisible' : ''

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[35] flex flex-col justify-between p-3 sm:p-4">
        <div className={`flex justify-end transition-[margin] duration-300 ${besidePanel}`}>
          <SceneControls />
        </div>
        <div
          className={`grid grid-cols-1 items-end gap-2 transition-[margin] duration-300 ${exhibitOpen ? 'lg:grid-cols-1' : ''} sm:grid-cols-[1fr_auto_1fr] ${besidePanel} ${underSheet}`}
        >
          <div className="flex max-sm:hidden">
            {atCampus && (
              // Just the arrow: the corner narrows as the tab bar grows, and a
              // round button fits however many buildings the estate has.
              <button
                type="button"
                onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}
                aria-label={site.scrollCue}
                title={site.scrollCue}
                className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-paper/70 font-body text-step-1 text-ink/70 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)] backdrop-blur-[12px] transition-[color,border-color,box-shadow] duration-200 hover:border-glow/60 hover:text-ink hover:shadow-[0_8px_26px_-8px_rgb(var(--ui-glow)/0.6)]"
              >
                <span aria-hidden className="inline-block motion-safe:animate-bounce">
                  ↓
                </span>
              </button>
            )}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <TabBar />
            {/* Beside an open panel there is room for the tab bar alone. */}
            <div className={`max-sm:hidden ${exhibitOpen ? 'lg:hidden' : ''}`}>
              <ControlsHint />
            </div>
          </div>
          <div className={`flex justify-end max-sm:hidden ${exhibitOpen ? 'lg:hidden' : ''}`}>
            <Location />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-40">
        <PlotPanel />
      </div>
    </>
  )
}

// Split hero: who on the left, the estate on the right; on a phone the
// estate comes first and the introduction follows. The introduction is first
// in the DOM either way, so the keyboard meets the name, the links and the
// list before the scene's own controls.
export function Hero() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="flex flex-col lg:h-screen lg:flex-row">
        <div className="order-2 w-full lg:order-1 lg:h-full lg:w-[42%]">
          <IntroColumn />
        </div>
        <div className="relative order-1 h-[42vh] w-full overflow-hidden md:h-[55vh] lg:order-2 lg:h-full lg:w-[58%]">
          <SceneColumn />
          <SceneOverlay />
        </div>
      </section>
    </MotionConfig>
  )
}
