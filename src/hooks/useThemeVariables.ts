import { useLayoutEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { DUSK } from '@/scene/constants'
import { useEstate } from '@/store/useEstate'
import { ACCENT, ui, type UiColours } from '@/theme'

type Rgb = [number, number, number]
type Palette = Record<keyof UiColours, Rgb>

const KEYS: (keyof UiColours)[] = ['ink', 'paper', 'sky', 'onAccent', 'glow']
const VARIABLE: Record<keyof UiColours, string> = {
  ink: '--ui-ink',
  paper: '--ui-paper',
  sky: '--ui-sky',
  onAccent: '--ui-on-accent',
  glow: '--ui-glow',
}

function rgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function paletteOf(colours: UiColours): Palette {
  return {
    ink: rgb(colours.ink),
    paper: rgb(colours.paper),
    sky: rgb(colours.sky),
    onAccent: rgb(colours.onAccent),
    glow: rgb(colours.glow),
  }
}

// The same curve the scene's sky fades on, so page and scene turn together.
function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

function write(palette: Palette) {
  const root = document.documentElement.style
  for (const key of KEYS) root.setProperty(VARIABLE[key], palette[key].map(Math.round).join(' '))
}

// Writes the theme's UI colours onto the root element as CSS variables, which
// every ink, paper, sky and accent class reads. A theme change fades them over
// the same time the sky takes, rather than switching in one frame while the
// scene is still mid-fade — a variable holding "r g b" can't be transitioned
// by CSS, so the fade is stepped here. The first run and reduced motion jump.
export function useThemeVariables(): void {
  const theme = useEstate((state) => state.theme)
  const prefersReducedMotion = usePrefersReducedMotion()
  const current = useRef<Palette | null>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.setProperty('--ui-accent', rgb(ACCENT).join(' '))

    const target = paletteOf(ui[theme])
    const from = current.current
    if (!from || prefersReducedMotion) {
      current.current = target
      write(target)
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const k = smooth(Math.min((now - start) / 1000 / DUSK.colourEnd, 1))
      const next = {} as Palette
      for (const key of KEYS) {
        next[key] = from[key].map((value, index) => value + (target[key][index] - value) * k) as Rgb
      }
      current.current = next
      write(next)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    // Lands on the target even if frames stop coming mid-fade, so the page
    // can never be left in between the two themes.
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(frame)
      current.current = target
      write(target)
    }, DUSK.colourEnd * 1000 + 50)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settle)
    }
  }, [theme, prefersReducedMotion])
}
