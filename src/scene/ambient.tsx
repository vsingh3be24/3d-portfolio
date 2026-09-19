import { useFrame } from '@react-three/fiber'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useEstate } from '@/store/useEstate'
import { CAMERA } from './constants'

// The clock every self-running shader motion reads: tree sway, ripples,
// birds. One uniform shared by all of them, advanced only while motion is
// allowed, so pause and reduced motion freeze the whole estate at once.
export const ambientTime = { value: 0 }

export function AmbientClock() {
  const paused = useEstate((state) => state.paused)
  const prefersReducedMotion = usePrefersReducedMotion()

  useFrame((_, delta) => {
    if (paused || prefersReducedMotion) return
    ambientTime.value += Math.min(delta, CAMERA.maxFrameDelta)
  })

  return null
}
