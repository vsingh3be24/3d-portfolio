import { useEstate } from '@/store/useEstate'

// The first sight of the estate, shared by the camera, which sweeps in, and
// the lights, which come on as it arrives. Whether it plays is decided once,
// the first time either asks, so the two can never disagree.
let plays: boolean | null = null
let revealedAt: number | null = null
const listeners = new Set<() => void>()

function now(): number {
  return performance.now() / 1000
}

// Only for a visitor arriving on the campus with motion allowed: a link
// straight into a building goes straight there, and reduced or paused motion
// sees the estate as it is.
export function introPlays(): boolean {
  if (plays === null) {
    const { level, paused } = useEstate.getState()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    plays = level === 'campus' && !paused && !reduced
  }
  return plays
}

// Called once, as the loading screen starts to fade.
export function markRevealed(): void {
  if (revealedAt !== null) return
  revealedAt = now()
  listeners.forEach((listener) => listener())
  listeners.clear()
}

// Seconds since the reveal, or null while the loading screen still covers it.
export function sinceReveal(): number | null {
  return revealedAt === null ? null : now() - revealedAt
}

// Runs the listener at the reveal, or straight away if it has happened.
export function onReveal(listener: () => void): () => void {
  if (revealedAt !== null) {
    listener()
    return () => {}
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}
