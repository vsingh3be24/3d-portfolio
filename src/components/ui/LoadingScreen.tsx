import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { site } from '@/data/site'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { LOADING, UI } from '@/scene/constants'
import { stageProgress, subscribeStages } from '@/scene/loading'
import { useEstate } from '@/store/useEstate'
import { ACCENT, themes } from '@/theme'

// The number on screen. Kept outside the component because the screen is
// shown by two owners in turn — the Suspense fallback while the scene's code
// arrives, then the scene itself until its first frame — and the count must
// carry straight on across that hand-over rather than restart from zero.
let shownProgress = 0

// While the scene's code is still arriving there is no three.js to ask, so
// the stages are read directly. Same stages, same count as useProgress gives
// once the scene is here.
export function StagedLoadingScreen() {
  const progress = useSyncExternalStore(subscribeStages, stageProgress)
  return <LoadingScreen progress={progress} />
}

// Full-bleed over the scene area, on the theme's own background, so the
// estate fades up out of the colour it will sit on.
export function LoadingScreen({ progress, leaving = false }: { progress: number; leaving?: boolean }) {
  const theme = useEstate((state) => state.theme)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [shown, setShown] = useState(shownProgress)
  const target = useRef(progress)
  useEffect(() => {
    target.current = progress
  }, [progress])

  // Eases toward the real figure and never runs ahead of it. Under reduced
  // motion it simply shows the real figure.
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const goal = target.current
      const eased = shownProgress + (goal - shownProgress) * (1 - Math.pow(LOADING.counterDecay, dt))
      // An exponential approach never quite arrives, so close enough is there.
      shownProgress = prefersReducedMotion || goal - eased < LOADING.counterSnap ? goal : eased
      setShown(shownProgress)
      if (shownProgress < 100) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [prefersReducedMotion])

  // Leaving means the last stage is done: the screen fades out on 100, never
  // on a figure the counter hadn't caught up to yet.
  const figure = leaving ? 100 : Math.floor(shown)

  const palette = themes[theme]
  const ink = theme === 'day' ? palette.ink : palette.paper

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${site.loadingLine}, ${figure} percent`}
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 transition-opacity ease-out"
      style={{
        backgroundColor: palette.groundFar,
        color: ink,
        opacity: leaving ? 0 : 1,
        transitionDuration: prefersReducedMotion ? '0ms' : `${UI.revealDurationMs}ms`,
      }}
    >
      <p className="font-body text-step-0 uppercase tracking-[0.16em] opacity-60">{site.loadingLine}</p>
      <p className="font-display text-step-5 font-semibold tabular-nums leading-none tracking-[-0.02em]">{figure}%</p>
      {/* A thin bar that fills with the counter. */}
      <div aria-hidden className="mt-2 h-[3px] w-40 overflow-hidden rounded-full" style={{ backgroundColor: `${ink}22` }}>
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-out"
          style={{ width: `${figure}%`, backgroundColor: ACCENT }}
        />
      </div>
    </div>
  )
}
