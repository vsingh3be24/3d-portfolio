import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three'
import { ambientTime, pointScale, POINT_SIZE_GLSL } from './ambient'
import { DUSK, FIREFLIES } from './constants'
import { stage } from './dusk'
import { isOnSlab } from './slab'

const f = (value: number) => value.toFixed(4)

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Scattered over the slab at knee to head height.
function buildSwarm(): BufferGeometry {
  const random = mulberry32(FIREFLIES.seed)
  const position: number[] = []
  const seed: number[] = []
  let attempts = 0
  while (seed.length < FIREFLIES.count && attempts < 5000) {
    attempts += 1
    const x = (random() * 2 - 1) * FIREFLIES.radius
    const z = (random() * 2 - 1) * FIREFLIES.radius
    if (!isOnSlab(x, z, 1)) continue
    const [low, high] = FIREFLIES.height
    position.push(x, low + random() * (high - low), z)
    seed.push(random())
  }
  const swarm = new BufferGeometry()
  swarm.setAttribute('position', new BufferAttribute(new Float32Array(position), 3))
  swarm.setAttribute('aSeed', new BufferAttribute(new Float32Array(seed), 1))
  return swarm
}

// How far the lamps are on: fireflies come out with them.
const night = { value: 0 }

// Each wanders round its own spot on slow, unrelated sine paths and blinks on
// its own rhythm. Additive and untoned, so a blink reads as light.
const material = new ShaderMaterial({
  uniforms: {
    uTime: ambientTime,
    pointScale,
    uNight: night,
    uColour: { value: new Color(FIREFLIES.colour).multiplyScalar(FIREFLIES.brightness) },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float pointScale;
    uniform float uNight;
    attribute float aSeed;
    varying float vGlow;
    ${POINT_SIZE_GLSL}
    void main() {
      float s = aSeed * 6.2831;
      vec3 p = position + vec3(
        sin( uTime * 0.37 + s * 3.1 ),
        sin( uTime * 0.61 + s * 5.3 ) * 0.4,
        cos( uTime * 0.29 + s * 2.3 )
      ) * ${f(FIREFLIES.wander)};
      float blink = pow( max( sin( uTime * ( 1.2 + aSeed ) + s * 9.0 ), 0.0 ), 3.0 );
      vGlow = ( 0.25 + blink ) * uNight;
      vec4 mv = viewMatrix * vec4( p, 1.0 );
      gl_Position = projectionMatrix * mv;
      gl_PointSize = worldPointSize( ${f(FIREFLIES.size)} * ( 0.6 + blink ), mv ) * step( 0.001, uNight );
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColour;
    varying float vGlow;
    void main() {
      float edge = length( gl_PointCoord - 0.5 ) * 2.0;
      float glow = pow( max( 1.0 - edge, 0.0 ), 2.0 ) * vGlow;
      if ( glow < 0.01 ) discard;
      gl_FragColor = vec4( uColour * glow, 1.0 );
    }`,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
})

export function Fireflies() {
  const geometry = useMemo(() => buildSwarm(), [])

  useFrame(() => {
    night.value = stage(DUSK.lampStart, DUSK.lampEnd)
  })

  // Always in the scene, drawing nothing by day, so the shader is compiled
  // behind the loading screen rather than on the first dusk.
  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
}
