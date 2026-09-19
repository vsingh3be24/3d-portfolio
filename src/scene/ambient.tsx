import { useFrame } from '@react-three/fiber'
import { Vector2 } from 'three'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useEstate } from '@/store/useEstate'
import { CAMERA } from './constants'

// The clock every self-running shader motion reads: tree sway, ripples,
// birds, the fountain, smoke. One uniform shared by all of them, advanced only
// while motion is allowed, so pause and reduced motion freeze the whole
// estate at once.
export const ambientTime = { value: 0 }

// Half the drawing buffer's height in pixels. A point shader multiplies it by
// the projection's focal term and divides by depth, which sizes a point in
// world units, so smoke and spray shrink with distance like everything else.
export const pointScale = { value: 1 }

// For point shaders: a world-space size at this view-space position, in pixels.
export const POINT_SIZE_GLSL = /* glsl */ `
  float worldPointSize( float size, vec4 mvPosition ) {
    return size * projectionMatrix[ 1 ][ 1 ] * pointScale / -mvPosition.z;
  }
`

const buffer = new Vector2()

export function AmbientClock() {
  const paused = useEstate((state) => state.paused)
  const prefersReducedMotion = usePrefersReducedMotion()

  useFrame((state, delta) => {
    pointScale.value = state.gl.getDrawingBufferSize(buffer).y / 2
    if (paused || prefersReducedMotion) return
    ambientTime.value += Math.min(delta, CAMERA.maxFrameDelta)
  })

  return null
}
